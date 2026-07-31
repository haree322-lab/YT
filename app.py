import os
import re
import sys
import uuid
import time
import json
import queue
import shutil
import subprocess
import threading
from pathlib import Path
from flask import Flask, request, jsonify, Response, send_from_directory, render_template
from flask_cors import CORS

app = Flask(__name__, static_folder='static', template_folder='.')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max per chunk payload

# Enable CORS for cross-origin frontend (Cloudflare Pages)
CORS(app, resources={r"/api/*": {"origins": "*"}})

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / 'uploads'
TEMP_DIR = UPLOADS_DIR / 'temp'
UPLOADS_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

# Detect FFmpeg binary (Linux / Render / Windows)
FFMPEG_PATH = shutil.which("ffmpeg") or r"C:\ffmpeg\bin\ffmpeg.exe"

ALLOWED_EXTENSIONS = {'.mp4', '.mkv', '.mov', '.avi', '.webm'}
MAX_TOTAL_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2 GB limit

active_uploads = {}

class StreamManager:
    def __init__(self):
        self.process = None
        self.lock = threading.Lock()
        self.status = "IDLE"  # IDLE, STREAMING, STOPPING, ERROR
        self.start_time = None
        self.current_video_id = None
        self.current_video_name = None
        self.mode = "single"  # single or loop
        self.stream_key_masked = ""
        self.log_listeners = []
        self.log_history = []
        self.stats = {"fps": 0, "bitrate": "0kbits/s", "time": "00:00:00", "speed": "0x"}
        self.error_message = None
        self.concat_file_path = None

    def add_log(self, line):
        masked_line = sanitize_log_line(line, self.stream_key_raw if hasattr(self, 'stream_key_raw') else "")
        timestamp = time.strftime("[%H:%M:%S] ")
        full_line = timestamp + masked_line.strip()
        
        if "fps=" in line and "bitrate=" in line:
            self._parse_ffmpeg_stats(line)

        self.log_history.append(full_line)
        if len(self.log_history) > 300:
            self.log_history.pop(0)

        dead_listeners = []
        for q in list(self.log_listeners):
            try:
                q.put_nowait(full_line)
            except queue.Full:
                dead_listeners.append(q)
        for q in dead_listeners:
            if q in self.log_listeners:
                self.log_listeners.remove(q)

    def _parse_ffmpeg_stats(self, line):
        try:
            fps_match = re.search(r"fps=\s*([\d\.]+)", line)
            bitrate_match = re.search(r"bitrate=\s*([\d\.]+\s*\w+/s|N/A)", line)
            time_match = re.search(r"time=\s*([\d:\.]+)", line)
            speed_match = re.search(r"speed=\s*([\d\.]+x|N/A)", line)
            
            if fps_match:
                self.stats["fps"] = float(fps_match.group(1))
            if bitrate_match:
                self.stats["bitrate"] = bitrate_match.group(1)
            if time_match:
                self.stats["time"] = time_match.group(1)
            if speed_match:
                self.stats["speed"] = speed_match.group(1)
        except Exception:
            pass

    def start_stream(self, video_paths_list, video_names_list, stream_key, mode="single", preset="720p60", audio_option="original"):
        with self.lock:
            if self.process and self.process.poll() is None:
                return False, "A live stream is already active!"

            if not os.path.exists(FFMPEG_PATH) and not shutil.which(FFMPEG_PATH):
                return False, f"FFmpeg binary not found at {FFMPEG_PATH}"

            if not video_paths_list:
                return False, "No target videos selected for playlist"

            for vpath in video_paths_list:
                if not os.path.exists(vpath):
                    return False, f"Video file not found: {os.path.basename(vpath)}"

            stream_key_clean = stream_key.strip()
            if not stream_key_clean or len(stream_key_clean) < 4:
                return False, "Invalid stream key provided"

            self.stream_key_raw = stream_key_clean
            self.stream_key_masked = mask_stream_key(stream_key_clean)
            self.current_video_id = f"Playlist ({len(video_paths_list)} items)"
            self.current_video_name = ", ".join(video_names_list[:2]) + (f" (+{len(video_names_list)-2} more)" if len(video_names_list) > 2 else "")
            self.mode = mode
            self.status = "STREAMING"
            self.start_time = time.time()
            self.error_message = None
            self.log_history.clear()
            self.stats = {"fps": 0, "bitrate": "0kbits/s", "time": "00:00:00", "speed": "0x"}

            # Build Concat Playlist file
            playlist_id = str(uuid.uuid4())
            self.concat_file_path = UPLOADS_DIR / f"concat_{playlist_id}.txt"
            with open(self.concat_file_path, 'w', encoding='utf-8') as f:
                for vpath in video_paths_list:
                    # FFmpeg concat file format
                    safe_path_str = str(Path(vpath).resolve()).replace('\\', '/')
                    f.write(f"file '{safe_path_str}'\n")

            rtmps_url = f"rtmps://a.rtmp.youtube.com:443/live2/{stream_key_clean}"

            cmd = [
                FFMPEG_PATH,
                "-re",
                "-f", "concat",
                "-safe", "0",
                "-loglevel", "info"
            ]

            if mode == "loop":
                cmd.extend(["-stream_loop", "-1"])

            cmd.extend(["-i", str(self.concat_file_path)])

            cmd.extend([
                "-flvflags", "no_duration_filesize",
                "-max_muxing_queue_size", "1024"
            ])

            if preset == "1080p60":
                cmd.extend([
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-b:v", "6000k",
                    "-maxrate", "6000k",
                    "-bufsize", "12000k",
                    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
                    "-r", "60",
                    "-g", "120",
                    "-pix_fmt", "yuv420p"
                ])
            elif preset == "passthrough":
                cmd.extend([
                    "-c:v", "copy"
                ])
            else: # Default 720p60
                cmd.extend([
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-b:v", "4000k",
                    "-maxrate", "4000k",
                    "-bufsize", "8000k",
                    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
                    "-r", "60",
                    "-g", "120",
                    "-pix_fmt", "yuv420p"
                ])

            if audio_option == "mute":
                cmd.extend(["-an"])
            elif audio_option == "silent":
                cmd.extend([
                    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                    "-c:a", "aac", "-b:a", "128k", "-ar", "44100"
                ])
            else:
                cmd.extend([
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-ar", "44100"
                ])

            cmd.extend([
                "-f", "flv",
                rtmps_url
            ])

            self.add_log(f"Starting YouTube Live Playlist Stream [{mode.upper()} MODE]...")
            self.add_log(f"Playlist: {len(video_paths_list)} videos ({self.current_video_name})")
            self.add_log(f"Target RTMPS: rtmps://a.rtmp.youtube.com:443/live2/{self.stream_key_masked}")

            try:
                creation_flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    creationflags=creation_flags
                )

                threading.Thread(target=self._monitor_output, daemon=True).start()
                return True, f"Playlist stream ({len(video_paths_list)} videos) started successfully!"
            except Exception as e:
                self.status = "ERROR"
                self.error_message = str(e)
                self.add_log(f"Error starting FFmpeg process: {e}")
                return False, f"Failed to start stream process: {e}"

    def _monitor_output(self):
        proc = self.process
        if not proc:
            return

        for line in iter(proc.stdout.readline, ''):
            if line:
                self.add_log(line)

        proc.stdout.close()
        return_code = proc.wait()

        # Clean up temp concat file
        if self.concat_file_path and self.concat_file_path.exists():
            try:
                self.concat_file_path.unlink()
            except Exception:
                pass

        with self.lock:
            if self.status != "STOPPING":
                if return_code == 0:
                    self.add_log("Stream finished naturally (Return Code 0).")
                    self.status = "IDLE"
                else:
                    self.add_log(f"Stream ended with code {return_code}.")
                    self.status = "IDLE" if self.status != "ERROR" else "ERROR"
            else:
                self.add_log("Stream stopped by user.")
                self.status = "IDLE"
            self.process = None

    def stop_stream(self):
        with self.lock:
            if not self.process or self.process.poll() is not None:
                self.status = "IDLE"
                return True, "No active stream to stop."

            self.status = "STOPPING"
            self.add_log("Stopping stream process...")
            try:
                self.process.terminate()
                threading.Thread(target=self._kill_after_delay, args=(self.process, 3), daemon=True).start()
                return True, "Stop signal sent to stream."
            except Exception as e:
                return False, f"Failed to stop stream: {e}"

    def _kill_after_delay(self, proc, delay):
        time.sleep(delay)
        if proc.poll() is None:
            try:
                proc.kill()
                self.add_log("Force killed stream process.")
            except Exception:
                pass

    def get_status(self):
        is_running = self.process is not None and self.process.poll() is None
        elapsed = 0
        if is_running and self.start_time:
            elapsed = int(time.time() - self.start_time)

        return {
            "status": self.status if is_running else ("IDLE" if self.status != "ERROR" else "ERROR"),
            "is_running": is_running,
            "mode": self.mode,
            "video_id": self.current_video_id,
            "video_name": self.current_video_name,
            "stream_key_masked": self.stream_key_masked,
            "elapsed_seconds": elapsed,
            "stats": self.stats,
            "error_message": self.error_message
        }

stream_mgr = StreamManager()

def mask_stream_key(key):
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "-" + "*" * (len(key) - 8) + "-" + key[-4:]

def sanitize_log_line(line, raw_key):
    if raw_key and raw_key in line:
        masked = mask_stream_key(raw_key)
        line = line.replace(raw_key, masked)
    return line

def validate_magic_bytes(file_path):
    try:
        with open(file_path, 'rb') as f:
            header = f.read(16)
        if len(header) < 4:
            return False
        if b'ftyp' in header or b'moov' in header or b'mdat' in header:
            return True
        if header.startswith(b'\x1a\x45\xdf\xa3'):
            return True
        if header.startswith(b'RIFF') and b'AVI' in header:
            return True
        return True
    except Exception:
        return False


# --- ROUTES ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

@app.route('/api/upload/init', methods=['POST'])
def upload_init():
    data = request.get_json() or {}
    filename = os.path.basename(data.get('filename', 'video.mp4'))
    total_size = int(data.get('total_size', 0))

    if total_size <= 0 or total_size > MAX_TOTAL_FILE_SIZE:
        return jsonify({'error': 'Invalid file size. Maximum allowed size is 2GB.'}), 400

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Unsupported file extension {ext}. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

    upload_id = str(uuid.uuid4())
    temp_upload_dir = TEMP_DIR / upload_id
    temp_upload_dir.mkdir(parents=True, exist_ok=True)

    active_uploads[upload_id] = {
        'filename': filename,
        'extension': ext,
        'total_size': total_size,
        'received_chunks': {},
        'temp_dir': str(temp_upload_dir),
        'created_at': time.time()
    }

    return jsonify({
        'upload_id': upload_id,
        'chunk_size': 10 * 1024 * 1024
    })

@app.route('/api/upload/chunk', methods=['POST'])
def upload_chunk():
    upload_id = request.form.get('upload_id')
    chunk_index = request.form.get('chunk_index')
    chunk_file = request.files.get('file')

    if not upload_id or upload_id not in active_uploads or chunk_index is None or not chunk_file:
        return jsonify({'error': 'Invalid chunk upload parameters.'}), 400

    chunk_index = int(chunk_index)
    meta = active_uploads[upload_id]
    chunk_path = Path(meta['temp_dir']) / f"chunk_{chunk_index:05d}.part"

    chunk_file.save(str(chunk_path))
    meta['received_chunks'][chunk_index] = chunk_path.stat().st_size

    total_received = sum(meta['received_chunks'].values())
    progress = round((total_received / meta['total_size']) * 100, 2)

    return jsonify({
        'status': 'chunk_saved',
        'chunk_index': chunk_index,
        'progress': progress
    })

@app.route('/api/upload/complete', methods=['POST'])
def upload_complete():
    data = request.get_json() or {}
    upload_id = data.get('upload_id')

    if not upload_id or upload_id not in active_uploads:
        return jsonify({'error': 'Invalid upload session.'}), 400

    meta = active_uploads.pop(upload_id)
    temp_dir = Path(meta['temp_dir'])

    final_video_id = str(uuid.uuid4())
    final_filename = f"{final_video_id}{meta['extension']}"
    final_path = UPLOADS_DIR / final_filename

    chunk_files = sorted(temp_dir.glob("chunk_*.part"))
    with open(final_path, 'wb') as outfile:
        for cfile in chunk_files:
            with open(cfile, 'rb') as infile:
                while True:
                    buffer = infile.read(1024 * 1024)
                    if not buffer:
                        break
                    outfile.write(buffer)

    try:
        for cfile in chunk_files:
            cfile.unlink()
        temp_dir.rmdir()
    except Exception:
        pass

    if not validate_magic_bytes(final_path):
        final_path.unlink(missing_ok=True)
        return jsonify({'error': 'Uploaded file failed magic byte verification check.'}), 400

    final_size = final_path.stat().st_size

    video_meta = {
        'id': final_video_id,
        'name': meta['filename'],
        'filename': final_filename,
        'size': final_size,
        'created_at': time.time()
    }
    with open(UPLOADS_DIR / f"{final_video_id}.json", 'w') as f:
        json.dump(video_meta, f)

    return jsonify({
        'status': 'completed',
        'video': video_meta
    })

@app.route('/api/videos', methods=['GET'])
def list_videos():
    videos = []
    for meta_file in UPLOADS_DIR.glob("*.json"):
        try:
            with open(meta_file, 'r') as f:
                vmeta = json.load(f)
                video_file = UPLOADS_DIR / vmeta['filename']
                if video_file.exists():
                    vmeta['size_mb'] = round(vmeta['size'] / (1024 * 1024), 2)
                    videos.append(vmeta)
        except Exception:
            pass

    videos.sort(key=lambda x: x.get('created_at', 0), reverse=True)
    return jsonify({'videos': videos})

@app.route('/api/videos/<video_id>', methods=['DELETE'])
def delete_video(video_id):
    safe_id = os.path.basename(video_id)
    meta_path = UPLOADS_DIR / f"{safe_id}.json"

    if not meta_path.exists():
        return jsonify({'error': 'Video metadata not found.'}), 404

    try:
        with open(meta_path, 'r') as f:
            vmeta = json.load(f)

        vfile = UPLOADS_DIR / vmeta['filename']
        if vfile.exists():
            vfile.unlink()
        meta_path.unlink()
        return jsonify({'status': 'deleted', 'id': safe_id})
    except Exception as e:
        return jsonify({'error': f'Failed to delete video: {e}'}), 500

@app.route('/api/video/file/<video_id>', methods=['GET'])
def serve_video_file(video_id):
    safe_id = os.path.basename(video_id)
    meta_path = UPLOADS_DIR / f"{safe_id}.json"
    if not meta_path.exists():
        return jsonify({'error': 'Video not found'}), 404

    with open(meta_path, 'r') as f:
        vmeta = json.load(f)

    return send_from_directory(UPLOADS_DIR, vmeta['filename'])

@app.route('/api/stream/start', methods=['POST'])
def start_stream():
    data = request.get_json() or {}
    stream_key = data.get('stream_key', '').strip()
    mode = data.get('mode', 'single')
    preset = data.get('preset', '720p60')
    audio_option = data.get('audio', 'original')

    # Support single video_id OR list of video_ids (playlist)
    video_ids = data.get('video_ids', [])
    if not video_ids and data.get('video_id'):
        video_ids = [data.get('video_id')]

    if not video_ids or not stream_key:
        return jsonify({'error': 'At least one video selection and a stream_key are required.'}), 400

    video_paths_list = []
    video_names_list = []

    for vid in video_ids:
        safe_vid = os.path.basename(vid)
        meta_path = UPLOADS_DIR / f"{safe_vid}.json"
        if meta_path.exists():
            with open(meta_path, 'r') as f:
                vmeta = json.load(f)
            vpath = UPLOADS_DIR / vmeta['filename']
            if vpath.exists():
                video_paths_list.append(vpath)
                video_names_list.append(vmeta['name'])

    if not video_paths_list:
        return jsonify({'error': 'Selected video file(s) were not found on server.'}), 404

    success, msg = stream_mgr.start_stream(
        video_paths_list=video_paths_list,
        video_names_list=video_names_list,
        stream_key=stream_key,
        mode=mode,
        preset=preset,
        audio_option=audio_option
    )

    if not success:
        return jsonify({'error': msg}), 400

    return jsonify({'status': 'started', 'message': msg})

@app.route('/api/stream/stop', methods=['POST'])
def stop_stream():
    success, msg = stream_mgr.stop_stream()
    if not success:
        return jsonify({'error': msg}), 400
    return jsonify({'status': 'stopping', 'message': msg})

@app.route('/api/stream/status', methods=['GET'])
def stream_status():
    return jsonify(stream_mgr.get_status())

@app.route('/api/stream/logs', methods=['GET'])
def stream_logs_sse():
    def event_stream():
        q = queue.Queue(maxsize=100)
        stream_mgr.log_listeners.append(q)

        for line in stream_mgr.log_history:
            yield f"data: {json.dumps({'log': line})}\n\n"

        while True:
            try:
                line = q.get(timeout=20)
                yield f"data: {json.dumps({'log': line})}\n\n"
            except queue.Empty:
                yield ": heartbeat\n\n"

    return Response(event_stream(), mimetype="text/event-stream")


if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    print(f"==========================================================")
    print(f" YouTube Live Streaming Backend Server (Playlist Engine)")
    print(f" Listening on http://{host}:{port}")
    print(f" FFmpeg path: {FFMPEG_PATH}")
    print(f"==========================================================")
    app.run(host=host, port=port, debug=False)
