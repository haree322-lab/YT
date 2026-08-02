import os
import sys
import json
import time
import uuid
import threading
import urllib.request
import urllib.error
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {'.mp4', '.mkv', '.mov', '.avi', '.webm'}
MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024   # 2 GB — Telegram Bot API file limit
DOWNLOAD_CHUNK_SIZE = 1024 * 1024         # 1 MB read chunks during streaming
PROGRESS_REPORT_EVERY_MB = 50             # Send a progress update every 50 MB


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def mask_stream_key(key: str) -> str:
    """Return a visually masked version of a stream key."""
    if not key:
        return ""
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "-" + "*" * (len(key) - 8) + "-" + key[-4:]


def validate_magic_bytes(file_path: Path) -> bool:
    """Lightweight file-type validation via magic bytes."""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(16)
        if len(header) < 4:
            return False
        # MP4 / MOV family
        if b'ftyp' in header or b'moov' in header or b'mdat' in header:
            return True
        # MKV / WebM
        if header.startswith(b'\x1a\x45\xdf\xa3'):
            return True
        # AVI
        if header.startswith(b'RIFF') and b'AVI' in header:
            return True
        # Fallback — still allow (extension was already validated)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# TelegramBot class
# ---------------------------------------------------------------------------

class TelegramBot:
    """
    Telegram Bot that controls YouTube Live Studio.
    Only responds to a single admin whose Telegram ID is set via
    TELEGRAM_ADMIN_ID (or TELEGRAM_ALLOWED_USERS) env var.
    All messages from any other sender are silently dropped.
    """

    def __init__(self, stream_mgr, uploads_dir):
        self.stream_mgr = stream_mgr
        self.uploads_dir = Path(uploads_dir)
        self.config_path = self.uploads_dir / 'telegram_config.json'

        self.token: str = os.environ.get('TELEGRAM_BOT_TOKEN', '')
        self.saved_stream_key: str = ''
        self.running: bool = False
        self.thread: threading.Thread | None = None

        # Track active downloads {chat_id: True} so we can warn about doubles
        self._active_downloads: dict[str, bool] = {}

        # Resolve admin ID — TELEGRAM_ADMIN_ID takes priority,
        # TELEGRAM_ALLOWED_USERS (first entry) used as fallback.
        admin_raw = (
            os.environ.get('TELEGRAM_ADMIN_ID', '')
            or os.environ.get('TELEGRAM_ALLOWED_USERS', '').split(',')[0]
        ).strip()
        self.admin_id: str = admin_raw

        self.load_config()

        if not self.admin_id:
            print("[Telegram Bot] ERROR: TELEGRAM_ADMIN_ID is not set. "
                  "Bot will start but ignore ALL messages.")
        else:
            print(f"[Telegram Bot] Admin-only mode. Authorised ID: {self.admin_id}")

    # ------------------------------------------------------------------
    # Config persistence
    # ------------------------------------------------------------------

    def load_config(self):
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                self.saved_stream_key = cfg.get('saved_stream_key', '')
            except Exception as exc:
                print(f"[Telegram Bot] Config load error: {exc}")

    def save_config(self):
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump({'saved_stream_key': self.saved_stream_key}, f, indent=4)
        except Exception as exc:
            print(f"[Telegram Bot] Config save error: {exc}")

    # ------------------------------------------------------------------
    # Telegram API helpers
    # ------------------------------------------------------------------

    def _api_url(self, method: str) -> str:
        return f"https://api.telegram.org/bot{self.token}/{method}"

    def make_request(self, method: str, data: dict | None = None, timeout: int = 30) -> dict | None:
        if not self.token:
            return None
        try:
            if data is not None:
                body = json.dumps(data).encode()
                req = urllib.request.Request(
                    self._api_url(method), data=body,
                    headers={'Content-Type': 'application/json'})
            else:
                req = urllib.request.Request(self._api_url(method))
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode())
        except Exception as exc:
            print(f"[Telegram Bot] API error ({method}): {exc}")
            return None

    def send_message(self, chat_id, text: str, parse_mode: str = "HTML") -> dict | None:
        return self.make_request("sendMessage", {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
        })

    def edit_message(self, chat_id, message_id: int, text: str) -> dict | None:
        return self.make_request("editMessageText", {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "parse_mode": "HTML",
        })

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def _is_admin(self, chat_id) -> bool:
        """Return True only if the sender is the configured admin."""
        return self.admin_id and str(chat_id) == self.admin_id

    def start(self):
        if not self.token:
            print("[Telegram Bot] TELEGRAM_BOT_TOKEN not set — bot disabled.")
            return
        self.running = True
        self.thread = threading.Thread(target=self._poll_loop, daemon=True, name="tg-poll")
        self.thread.start()
        print("[Telegram Bot] Polling thread started.")

        # Register commands in Telegram's '/' menu
        self._register_commands()

        # Startup notification — only to admin
        if self.admin_id:
            public_url = (os.environ.get('RENDER_EXTERNAL_URL')
                          or os.environ.get('SERVER_PUBLIC_URL')
                          or 'http://localhost:5000 (URL not configured)')
            self.send_message(self.admin_id, (
                "Bᴏᴛ Iꜱ Lɪᴠᴇ Nᴏᴡ 🤖\n\n"
                f"🔗 <b>URL:</b> <code>{public_url}</code>\n\n"
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "<b>📋 Available Commands</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "📤 <b>Upload video</b> — just send a file here\n\n"
                "📊 /status — Stream status & FFmpeg stats\n"
                "📂 /videos — List uploaded videos\n"
                "▶️ /stream &lt;num&gt; [preset] [mode] [audio]\n"
                "📋 /playlist &lt;1,2,3&gt; [preset] [mode] [audio]\n"
                "⏹️ /stop — Stop the active stream\n"
                "🗑️ /delete &lt;num&gt; — Delete a video\n"
                "🔑 /set_key &lt;key&gt; — Save stream key\n"
                "🔑 /get_key — Show saved key (masked)\n"
                "🔗 /url — Show backend URL\n"
                "📱 /help — Show this list\n\n"
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "<b>⚙️ Stream Options</b>\n"
                "━━━━━━━━━━━━━━━━━━━━━\n"
                "<i>preset:</i>  720p60 | 1080p60 | passthrough\n"
                "<i>mode:</i>    single | loop\n"
                "<i>audio:</i>   original | mute | silent"
            ))

    def stop(self):
        self.running = False

    def _register_commands(self):
        """Push the full command list to Telegram so it appears in the '/' menu."""
        commands = [
            {"command": "status",   "description": "📊 Live stream status & FFmpeg stats"},
            {"command": "videos",   "description": "📂 List videos stored on the server"},
            {"command": "stream",   "description": "▶️ Stream a video  /stream <num> [preset] [mode] [audio]"},
            {"command": "playlist", "description": "📋 Stream a playlist  /playlist <1,2,3> [preset] [mode] [audio]"},
            {"command": "stop",     "description": "⏹️ Stop the active live stream"},
            {"command": "delete",   "description": "🗑️ Delete a video  /delete <num>"},
            {"command": "set_key",  "description": "🔑 Save YouTube Stream Key  /set_key <key>"},
            {"command": "get_key",  "description": "🔑 Show saved stream key (masked)"},
            {"command": "url",      "description": "🔗 Show the backend public URL"},
            {"command": "help",     "description": "📱 Show all commands"},
        ]
        result = self.make_request("setMyCommands", {"commands": commands})
        if result and result.get("ok"):
            print(f"[Telegram Bot] Registered {len(commands)} commands in Telegram menu.")
        else:
            print(f"[Telegram Bot] Warning: setMyCommands failed: {result}")

    # ------------------------------------------------------------------
    # Polling
    # ------------------------------------------------------------------

    def _poll_loop(self):
        offset = 0
        while self.running:
            try:
                result = self.make_request(
                    "getUpdates", {"offset": offset, "timeout": 20}, timeout=30)
                if result and result.get("ok"):
                    for update in result.get("result", []):
                        offset = update["update_id"] + 1
                        threading.Thread(
                            target=self._safe_handle,
                            args=(update,), daemon=True).start()
            except Exception as exc:
                print(f"[Telegram Bot] Poll error: {exc}")
                time.sleep(5)
            time.sleep(0.3)

    def _safe_handle(self, update):
        try:
            self.handle_update(update)
        except Exception as exc:
            print(f"[Telegram Bot] Handler error: {exc}")

    # ------------------------------------------------------------------
    # Update dispatcher
    # ------------------------------------------------------------------

    def handle_update(self, update: dict):
        message = update.get("message")
        if not message:
            return

        chat = message.get("chat", {})
        chat_id = chat.get("id")
        text: str = message.get("text", "").strip()

        # ── Hard admin gate — silently drop everything from non-admin ──
        if not self._is_admin(chat_id):
            return

        # ---- Video / document upload ----
        file_obj = message.get("video") or message.get("document")
        if file_obj:
            caption: str = (message.get("caption") or "").strip()
            self._dispatch_upload(chat_id, file_obj, message.get("video") is not None, caption)
            return

        # ---- Command dispatch ----
        if not text.startswith("/"):
            return

        parts = text.split()
        cmd = parts[0].lower().split("@")[0]   # strip @BotName suffix
        args = parts[1:]

        dispatch = {
            "/start":    self._handle_help,
            "/help":     self._handle_help,
            "/status":   self._handle_status,
            "/stop":     self._handle_stop,
            "/videos":   self._handle_videos,
            "/stream":   lambda cid: self._handle_stream(cid, args),
            "/playlist": lambda cid: self._handle_playlist(cid, args),
            "/delete":   lambda cid: self._handle_delete(cid, args),
            "/set_key":  lambda cid: self._handle_set_key(cid, args),
            "/get_key":  self._handle_get_key,
            "/url":      self._handle_url,
        }

        handler = dispatch.get(cmd)
        if handler:
            handler(chat_id)
        else:
            self.send_message(chat_id, f"❓ Unknown command <code>{cmd}</code>. Send /help.")

    # /register removed — bot is admin-only, no registration needed

    # ------------------------------------------------------------------
    # /help
    # ------------------------------------------------------------------

    def _handle_help(self, chat_id):
        self.send_message(chat_id, (
            "📱 <b>YouTube Live Controller Bot</b>\n\n"
            "<b>📤 Upload video:</b>\n"
            "  Just send any video file (up to 2 GB) to this chat!\n"
            "  The server will download it automatically.\n\n"
            "<b>Commands:</b>\n"
            "🔹 /videos — List videos on the server\n"
            "🔹 /stream &lt;num&gt; [preset] [mode] [audio] — Start stream\n"
            "🔹 /playlist &lt;1,2,3&gt; [preset] [mode] [audio] — Playlist stream\n"
            "🔹 /delete &lt;num&gt; — Delete a video from server\n"
            "🔹 /stop — Stop the active stream\n"
            "🔹 /status — Live stream stats\n"
            "🔹 /set_key &lt;key&gt; — Save YouTube Stream Key\n"
            "🔹 /get_key — Show saved key (masked)\n"
            "🔹 /url — Show backend public URL\n\n"
            "<b>Presets:</b> 720p60 | 1080p60 | passthrough\n"
            "<b>Mode:</b> single | loop\n"
            "<b>Audio:</b> original | mute | silent"
        ))

    # ------------------------------------------------------------------
    # /status
    # ------------------------------------------------------------------

    def _handle_status(self, chat_id):
        s = self.stream_mgr.get_status()
        running = s.get("is_running", False)
        state = s.get("status", "IDLE")
        emoji = "🟢" if running else ("🔴" if state == "ERROR" else "⚪")
        lines = [f"ℹ️ <b>Status:</b> {state} {emoji}"]
        if running:
            elapsed = time.strftime("%H:%M:%S", time.gmtime(s.get("elapsed_seconds", 0)))
            st = s.get("stats", {})
            lines += [
                f"🎥 <b>Playing:</b> {s.get('video_name')}",
                f"🎛️ <b>Mode:</b> {s.get('mode','single').upper()}",
                f"⏱️ <b>Uptime:</b> {elapsed}",
                "",
                "📊 <b>FFmpeg Stats:</b>",
                f"• FPS: {st.get('fps', 0)}",
                f"• Bitrate: {st.get('bitrate', 'N/A')}",
                f"• Speed: {st.get('speed', 'N/A')}",
            ]
        elif state == "ERROR":
            lines.append(f"\n❌ <b>Error:</b> {s.get('error_message')}")
        else:
            lines.append("\nIdle. Send a video to upload, or /stream to start.")
        self.send_message(chat_id, "\n".join(lines))

    # ------------------------------------------------------------------
    # /stop
    # ------------------------------------------------------------------

    def _handle_stop(self, chat_id):
        ok, msg = self.stream_mgr.stop_stream()
        if ok:
            self.send_message(chat_id, "⏹️ <b>Stop signal sent.</b> Stream will end shortly.")
        else:
            self.send_message(chat_id, f"❌ {msg}")

    # ------------------------------------------------------------------
    # Video list helper
    # ------------------------------------------------------------------

    def _get_sorted_videos(self) -> list[dict]:
        videos = []
        for mf in self.uploads_dir.glob("*.json"):
            if mf.name == "telegram_config.json":
                continue
            try:
                with open(mf, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                vfile = self.uploads_dir / meta.get('filename', '')
                if vfile.exists():
                    videos.append(meta)
            except Exception:
                pass
        videos.sort(key=lambda x: x.get('created_at', 0), reverse=True)
        return videos

    # ------------------------------------------------------------------
    # /videos
    # ------------------------------------------------------------------

    def _handle_videos(self, chat_id):
        videos = self._get_sorted_videos()
        if not videos:
            self.send_message(
                chat_id,
                "📂 No videos on the server yet.\n\n"
                "Just <b>send a video file</b> to this chat to upload it!")
            return
        lines = ["📂 <b>Videos on server:</b>\n"]
        for i, v in enumerate(videos, 1):
            size_mb = round(v.get('size', 0) / 1024 / 1024, 1)
            lines.append(f"<b>[{i}]</b> {v.get('name')} <i>({size_mb} MB)</i>")
        lines.append("\nUse <code>/stream &lt;num&gt;</code> to start streaming.")
        lines.append("Use <code>/delete &lt;num&gt;</code> to remove a video.")
        self.send_message(chat_id, "\n".join(lines))

    # ------------------------------------------------------------------
    # /delete
    # ------------------------------------------------------------------

    def _handle_delete(self, chat_id, args: list):
        if not args or not args[0].isdigit():
            self.send_message(chat_id, "⚠️ Usage: <code>/delete &lt;video_num&gt;</code>")
            return
        videos = self._get_sorted_videos()
        idx = int(args[0]) - 1
        if idx < 0 or idx >= len(videos):
            self.send_message(chat_id, f"❌ No video at index {args[0]}.")
            return
        v = videos[idx]
        try:
            vfile = self.uploads_dir / v['filename']
            mfile = self.uploads_dir / f"{v['id']}.json"
            if vfile.exists():
                vfile.unlink()
            if mfile.exists():
                mfile.unlink()
            self.send_message(chat_id, f"🗑️ Deleted: <b>{v['name']}</b>")
        except Exception as exc:
            self.send_message(chat_id, f"❌ Delete failed: {exc}")

    # ------------------------------------------------------------------
    # Video upload via Telegram
    # ------------------------------------------------------------------

    def _dispatch_upload(self, chat_id, file_obj: dict, is_video_type: bool, caption: str):
        """
        Called when the user sends a video or document message.
        Spawns a background thread that:
          1. Calls getFile to obtain the CDN download path.
          2. Streams the file to disk in 1 MB chunks.
          3. Sends periodic progress edits on a single Telegram message.
          4. Validates magic bytes and writes metadata JSON.
        """
        chat_id_str = str(chat_id)

        if self._active_downloads.get(chat_id_str):
            self.send_message(
                chat_id,
                "⏳ A download is already in progress. "
                "Please wait for it to finish before sending another file.")
            return

        file_id: str = file_obj.get("file_id", "")
        file_size: int = file_obj.get("file_size", 0)

        # Determine filename
        if is_video_type:
            # Telegram video messages often have no filename; derive one
            original_name = caption.strip() or f"video_{int(time.time())}.mp4"
            if not any(original_name.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS):
                original_name += ".mp4"
        else:
            # Document messages carry the original filename
            original_name = file_obj.get("file_name", f"upload_{int(time.time())}.mp4")

        ext = Path(original_name).suffix.lower()

        # Validate extension
        if ext not in ALLOWED_EXTENSIONS:
            self.send_message(
                chat_id,
                f"❌ Unsupported file type <code>{ext}</code>.\n"
                f"Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
            return

        # Check size before even resolving the URL
        if file_size > MAX_FILE_SIZE:
            size_gb = round(file_size / 1024 / 1024 / 1024, 2)
            self.send_message(
                chat_id,
                f"❌ File too large ({size_gb} GB). Maximum is 2 GB.")
            return

        threading.Thread(
            target=self._download_worker,
            args=(chat_id, file_id, original_name, ext, file_size),
            daemon=True,
            name=f"tg-dl-{chat_id}",
        ).start()

    def _download_worker(self, chat_id, file_id: str, original_name: str, ext: str, declared_size: int):
        """Background thread: download file from Telegram and register it."""
        chat_id_str = str(chat_id)
        self._active_downloads[chat_id_str] = True

        # Step 1 — resolve the download URL via getFile
        notice = self.send_message(
            chat_id,
            "⏳ <b>Preparing download…</b>\nResolving file from Telegram servers…")
        notice_id: int | None = None
        if notice and notice.get("ok"):
            notice_id = notice["result"]["message_id"]

        try:
            file_info = self.make_request("getFile", {"file_id": file_id}, timeout=30)
            if not file_info or not file_info.get("ok"):
                self.send_message(chat_id, "❌ Failed to resolve file from Telegram. Try again.")
                return

            file_path_tg = file_info["result"]["file_path"]
            download_url = f"https://api.telegram.org/file/bot{self.token}/{file_path_tg}"
            actual_size: int = file_info["result"].get("file_size", declared_size)

            # Step 2 — stream to a temp file then rename
            video_id = str(uuid.uuid4())
            final_filename = f"{video_id}{ext}"
            tmp_path = self.uploads_dir / f"{video_id}.tmp"
            final_path = self.uploads_dir / final_filename

            size_mb_total = round(actual_size / 1024 / 1024, 1) if actual_size else "?"
            self._edit_or_send(chat_id, notice_id, (
                f"📥 <b>Downloading…</b>\n"
                f"📄 File: <code>{original_name}</code>\n"
                f"📦 Size: {size_mb_total} MB\n"
                "⏳ Starting…"
            ))

            downloaded = 0
            last_report_mb = 0
            last_edit_time = time.time()

            req = urllib.request.Request(download_url)
            with urllib.request.urlopen(req, timeout=60) as resp, \
                    open(tmp_path, 'wb') as out_f:

                while True:
                    chunk = resp.read(DOWNLOAD_CHUNK_SIZE)
                    if not chunk:
                        break
                    out_f.write(chunk)
                    downloaded += len(chunk)
                    downloaded_mb = downloaded / 1024 / 1024
                    now = time.time()

                    # Throttle progress edits (every 50 MB OR every 5 seconds)
                    if (downloaded_mb - last_report_mb >= PROGRESS_REPORT_EVERY_MB
                            or now - last_edit_time >= 5.0):
                        pct = (
                            f"{round(downloaded_mb / (actual_size / 1024 / 1024) * 100)}%"
                            if actual_size else "?"
                        )
                        bar = self._progress_bar(downloaded, actual_size)
                        self._edit_or_send(chat_id, notice_id, (
                            f"📥 <b>Downloading…</b>\n"
                            f"📄 <code>{original_name}</code>\n"
                            f"📦 {round(downloaded_mb, 1)} / {size_mb_total} MB  ({pct})\n"
                            f"{bar}"
                        ))
                        last_report_mb = downloaded_mb
                        last_edit_time = now

            # Rename tmp → final
            tmp_path.rename(final_path)

            # Step 3 — validate magic bytes
            if not validate_magic_bytes(final_path):
                final_path.unlink(missing_ok=True)
                self._edit_or_send(chat_id, notice_id,
                    "❌ File validation failed (magic bytes check). "
                    "Please send a valid video file.")
                return

            final_size = final_path.stat().st_size
            size_mb_final = round(final_size / 1024 / 1024, 1)

            # Step 4 — write metadata JSON (same format as web uploader)
            meta = {
                'id': video_id,
                'name': original_name,
                'filename': final_filename,
                'size': final_size,
                'created_at': time.time(),
                'source': 'telegram',
            }
            with open(self.uploads_dir / f"{video_id}.json", 'w', encoding='utf-8') as f:
                json.dump(meta, f)

            print(f"[Telegram Bot] Upload complete: {original_name} ({size_mb_final} MB) → {final_filename}")

            # Determine the new video's index in the list (it's #1 — newest first)
            self._edit_or_send(chat_id, notice_id, (
                f"✅ <b>Upload complete!</b>\n\n"
                f"🎬 <b>Name:</b> {original_name}\n"
                f"📦 <b>Size:</b> {size_mb_final} MB\n\n"
                f"Use /videos to see the full list, then:\n"
                f"<code>/stream 1</code>  — to stream it now\n"
                f"<code>/stream 1 1080p60 loop</code>  — with options"
            ))

        except urllib.error.HTTPError as exc:
            self._edit_or_send(chat_id, notice_id, f"❌ HTTP error during download: {exc.code} {exc.reason}")
            # Clean up partial file
            tmp_path_ref = self.uploads_dir / f"{file_id}.tmp"   # best-effort
            for p in self.uploads_dir.glob("*.tmp"):
                try:
                    p.unlink()
                except Exception:
                    pass
        except Exception as exc:
            print(f"[Telegram Bot] Download error: {exc}")
            self._edit_or_send(chat_id, notice_id, f"❌ Download failed: {exc}")
            for p in self.uploads_dir.glob("*.tmp"):
                try:
                    p.unlink()
                except Exception:
                    pass
        finally:
            self._active_downloads.pop(chat_id_str, None)

    def _edit_or_send(self, chat_id, message_id: int | None, text: str):
        """Edit an existing message if we have its ID, otherwise send a new one."""
        if message_id:
            result = self.edit_message(chat_id, message_id, text)
            if result and result.get("ok"):
                return
        self.send_message(chat_id, text)

    @staticmethod
    def _progress_bar(downloaded: int, total: int, width: int = 16) -> str:
        if not total:
            return "▓" * width
        filled = int(width * downloaded / total)
        return "▓" * filled + "░" * (width - filled)

    # ------------------------------------------------------------------
    # /stream
    # ------------------------------------------------------------------

    def _handle_stream(self, chat_id, args: list):
        if not args:
            self.send_message(
                chat_id,
                "⚠️ Usage: <code>/stream &lt;num&gt; [preset] [mode] [audio]</code>\n"
                "e.g. <code>/stream 1 720p60 loop original</code>")
            return

        video_ref = args[0]
        preset    = args[1] if len(args) > 1 else "720p60"
        mode      = args[2] if len(args) > 2 else "single"
        audio     = args[3] if len(args) > 3 else "original"

        err = self._validate_stream_opts(chat_id, preset, mode, audio)
        if err:
            return

        videos = self._get_sorted_videos()
        video = self._resolve_video(video_ref, videos)
        if not video:
            self.send_message(chat_id, f"❌ No video at <code>{video_ref}</code>. Use /videos to list.")
            return

        stream_key = self.saved_stream_key
        if not stream_key:
            self.send_message(chat_id,
                "❌ No stream key saved!\nSet it with: <code>/set_key &lt;key&gt;</code>")
            return

        ok, msg = self.stream_mgr.start_stream(
            video_paths_list=[str(self.uploads_dir / video['filename'])],
            video_names_list=[video['name']],
            stream_key=stream_key,
            mode=mode, preset=preset, audio_option=audio,
        )
        if ok:
            self.send_message(chat_id, (
                f"🟢 <b>Stream Started!</b>\n"
                f"🎬 {video['name']}\n"
                f"⚙️ Preset: {preset}  🎛️ Mode: {mode}  🔈 Audio: {audio}"
            ))
        else:
            self.send_message(chat_id, f"❌ {msg}")

    # ------------------------------------------------------------------
    # /playlist
    # ------------------------------------------------------------------

    def _handle_playlist(self, chat_id, args: list):
        if not args:
            self.send_message(
                chat_id,
                "⚠️ Usage: <code>/playlist &lt;1,2,3&gt; [preset] [mode] [audio]</code>")
            return

        indices_str = args[0]
        preset      = args[1] if len(args) > 1 else "720p60"
        mode        = args[2] if len(args) > 2 else "single"
        audio       = args[3] if len(args) > 3 else "original"

        err = self._validate_stream_opts(chat_id, preset, mode, audio)
        if err:
            return

        videos = self._get_sorted_videos()
        selected = []
        for ref in indices_str.split(','):
            v = self._resolve_video(ref.strip(), videos)
            if v:
                selected.append(v)

        if not selected:
            self.send_message(chat_id, "❌ No valid videos found. Check /videos for indices.")
            return

        stream_key = self.saved_stream_key
        if not stream_key:
            self.send_message(chat_id, "❌ No stream key. Use /set_key first.")
            return

        ok, msg = self.stream_mgr.start_stream(
            video_paths_list=[str(self.uploads_dir / v['filename']) for v in selected],
            video_names_list=[v['name'] for v in selected],
            stream_key=stream_key,
            mode=mode, preset=preset, audio_option=audio,
        )
        names = ", ".join(v['name'] for v in selected[:3])
        if len(selected) > 3:
            names += f" (+{len(selected) - 3} more)"
        if ok:
            self.send_message(chat_id, (
                f"🟢 <b>Playlist Started!</b>\n"
                f"🎬 {names} ({len(selected)} videos)\n"
                f"⚙️ Preset: {preset}  🎛️ Mode: {mode}  🔈 Audio: {audio}"
            ))
        else:
            self.send_message(chat_id, f"❌ {msg}")

    # ------------------------------------------------------------------
    # /set_key / /get_key
    # ------------------------------------------------------------------

    def _handle_set_key(self, chat_id, args: list):
        if not args:
            self.send_message(chat_id, "⚠️ Usage: <code>/set_key &lt;your_stream_key&gt;</code>")
            return
        key = args[0].strip()
        if len(key) < 4:
            self.send_message(chat_id, "❌ Stream key too short.")
            return
        self.saved_stream_key = key
        self.save_config()
        masked = mask_stream_key(key)
        self.send_message(chat_id, f"🔑 <b>Stream key saved!</b>  <code>{masked}</code>")
        print(f"[Telegram Bot] Stream key updated (masked: {masked})")

    def _handle_get_key(self, chat_id):
        if not self.saved_stream_key:
            self.send_message(chat_id, "🔑 No key saved. Use /set_key.")
        else:
            self.send_message(
                chat_id,
                f"🔑 <b>Saved key:</b> <code>{mask_stream_key(self.saved_stream_key)}</code>")

    # ------------------------------------------------------------------
    # /url
    # ------------------------------------------------------------------

    def _handle_url(self, chat_id):
        url = (os.environ.get('RENDER_EXTERNAL_URL')
               or os.environ.get('SERVER_PUBLIC_URL')
               or 'http://localhost:5000 (URL not configured)')
        self.send_message(chat_id, f"🔗 <b>Backend URL:</b>\n<code>{url}</code>")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _validate_stream_opts(self, chat_id, preset: str, mode: str, audio: str) -> bool:
        """Returns True (and sends error) if options are invalid."""
        allowed_presets = {"720p30", "720p60", "1080p30", "1080p60", "passthrough"}
        allowed_modes   = {"single", "loop"}
        allowed_audios  = {"original", "mute", "silent"}

        if preset not in allowed_presets:
            self.send_message(chat_id, f"❌ Invalid preset <code>{preset}</code>. Use: {', '.join(allowed_presets)}")
            return True
        if mode not in allowed_modes:
            self.send_message(chat_id, f"❌ Invalid mode <code>{mode}</code>. Use: {', '.join(allowed_modes)}")
            return True
        if audio not in allowed_audios:
            self.send_message(chat_id, f"❌ Invalid audio <code>{audio}</code>. Use: {', '.join(allowed_audios)}")
            return True
        return False

    @staticmethod
    def _resolve_video(ref: str, videos: list[dict]) -> dict | None:
        """Resolve a video by 1-based index string or UUID."""
        ref = ref.strip()
        if ref.isdigit():
            idx = int(ref) - 1
            if 0 <= idx < len(videos):
                return videos[idx]
        else:
            for v in videos:
                if v.get('id') == ref:
                    return v
        return None
