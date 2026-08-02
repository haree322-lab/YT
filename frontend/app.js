/* --- YOUTUBE LIVE STREAM STUDIO FRONTEND ENGINE (PLAYLIST PRO EDITION) --- */

document.addEventListener('DOMContentLoaded', () => {

    const backendUrlInput = document.getElementById('backendUrlInput');
    const btnSaveBackendUrl = document.getElementById('btnSaveBackendUrl');
    const backendConnStatus = document.getElementById('backendConnStatus');

    const dropZone = document.getElementById('dropZone');
    const videoFileInput = document.getElementById('videoFileInput');
    const btnBrowse = document.getElementById('btnBrowse');
    const uploadProgressPanel = document.getElementById('uploadProgressPanel');
    const uploadFileName = document.getElementById('uploadFileName');
    const uploadPercent = document.getElementById('uploadPercent');
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadStatusText = document.getElementById('uploadStatusText');
    const uploadSpeedText = document.getElementById('uploadSpeedText');

    const videoListContainer = document.getElementById('videoListContainer');
    const btnRefreshVideos = document.getElementById('btnRefreshVideos');
    const btnSelectAll = document.getElementById('btnSelectAll');
    const selectedCountBadge = document.getElementById('selectedCountBadge');

    const streamKeyInput = document.getElementById('streamKeyInput');
    const btnToggleKeyVisibility = document.getElementById('btnToggleKeyVisibility');
    const eyeIcon = document.getElementById('eyeIcon');
    const presetSelect = document.getElementById('presetSelect');
    const audioSelect = document.getElementById('audioSelect');

    const btnStartStream = document.getElementById('btnStartStream');
    const btnStopStream = document.getElementById('btnStopStream');

    const navLiveIndicator = document.getElementById('navLiveIndicator');
    const navLiveText = document.getElementById('navLiveText');
    const navTimer = document.getElementById('navTimer');
    const liveStatusBadge = document.getElementById('liveStatusBadge');

    const metricUptime = document.getElementById('metricUptime');
    const metricMode = document.getElementById('metricMode');
    const metricBitrate = document.getElementById('metricBitrate');
    const metricFPS = document.getElementById('metricFPS');

    const previewVideoName = document.getElementById('previewVideoName');
    const sourceVideoPlayer = document.getElementById('sourceVideoPlayer');

    const logConsole = document.getElementById('logConsole');
    const chkAutoScroll = document.getElementById('chkAutoScroll');
    const btnClearLogs = document.getElementById('btnClearLogs');

    const youtubeEmbedInput = document.getElementById('youtubeEmbedInput');
    const btnLoadEmbed = document.getElementById('btnLoadEmbed');
    const youtubeEmbedContainer = document.getElementById('youtubeEmbedContainer');

    const guideModal = document.getElementById('guideModal');
    const btnSetupGuide = document.getElementById('btnSetupGuide');
    const btnCloseGuide = document.getElementById('btnCloseGuide');
    const btnGotIt = document.getElementById('btnGotIt');

    // --- State Variables ---
    let backendUrl = localStorage.getItem('renderBackendUrl') || 'https://eden-assignments-periods-contributions.trycloudflare.com';
    backendUrl = backendUrl.replace(/\/+$/, '');
    if (!backendUrl.startsWith('http')) backendUrl = 'http://' + backendUrl;

    if (backendUrlInput) backendUrlInput.value = backendUrl;

    let availableVideos = [];
    let selectedVideoIds = [];
    let isUploading = false;
    let sseSource = null;
    let statusPollInterval = null;

    if (btnSaveBackendUrl) {
        btnSaveBackendUrl.addEventListener('click', () => {
            let val = backendUrlInput.value.trim().replace(/\/+$/, '');
            if (!val) {
                alert('Please enter your Backend URL.');
                return;
            }
            if (!val.startsWith('http://') && !val.startsWith('https://')) {
                val = 'http://' + val;
            }
            backendUrl = val;
            backendUrlInput.value = backendUrl;
            localStorage.setItem('renderBackendUrl', backendUrl);
            appendLog(`[Config] Saved Backend URL: ${backendUrl}`, 'info');

            checkBackendConnection();
            loadVideoLibrary();
            initSSELogs();
        });
    }

    async function checkBackendConnection() {
        if (!backendConnStatus) return;
        try {
            const res = await fetch(`${backendUrl}/api/stream/status`);
            if (res.ok) {
                backendConnStatus.className = 'conn-status-badge connected';
                backendConnStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Connected';
            } else {
                throw new Error('Non-200 status');
            }
        } catch (err) {
            backendConnStatus.className = 'conn-status-badge disconnected';
            backendConnStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Disconnected';
        }
    }

    // --- INITIALIZATION ---
    checkBackendConnection();
    loadVideoLibrary();
    initSSELogs();
    startStatusPolling();

    // --- UPLOAD HANDLERS ---
    btnBrowse.addEventListener('click', () => videoFileInput.click());
    videoFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleMultipleUploads(Array.from(e.target.files));
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleMultipleUploads(Array.from(e.dataTransfer.files));
        }
    });

    async function handleMultipleUploads(files) {
        for (let i = 0; i < files.length; i++) {
            await handleFileUpload(files[i], i + 1, files.length);
        }
        loadVideoLibrary();
    }

    async function handleFileUpload(file, fileNum = 1, totalFiles = 1) {
        const MAX_SIZE = 2 * 1024 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            alert(`File "${file.name}" exceeds 2GB maximum size limit.`);
            return;
        }

        isUploading = true;
        uploadProgressPanel.classList.remove('hidden');
        uploadFileName.textContent = `[${fileNum}/${totalFiles}] ${file.name}`;
        uploadPercent.textContent = '0%';
        uploadProgressBar.style.width = '0%';
        uploadStatusText.textContent = 'Initializing chunked upload...';
        uploadSpeedText.textContent = '0 MB/s';

        try {
            const initRes = await fetch(`${backendUrl}/api/upload/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    total_size: file.size
                })
            });

            if (!initRes.ok) {
                const errData = await initRes.json();
                throw new Error(errData.error || 'Failed to init upload');
            }

            const initData = await initRes.json();
            const uploadId = initData.upload_id;
            const chunkSize = initData.chunk_size;
            const totalChunks = Math.ceil(file.size / chunkSize);

            let startTime = Date.now();
            let uploadedBytes = 0;

            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(file.size, start + chunkSize);
                const chunkBlob = file.slice(start, end);

                const formData = new FormData();
                formData.append('upload_id', uploadId);
                formData.append('chunk_index', i);
                formData.append('file', chunkBlob);

                const chunkRes = await fetch(`${backendUrl}/api/upload/chunk`, {
                    method: 'POST',
                    body: formData
                });

                if (!chunkRes.ok) {
                    throw new Error(`Failed chunk ${i + 1} of ${totalChunks}`);
                }

                uploadedBytes += (end - start);
                const progressPct = ((uploadedBytes / file.size) * 100).toFixed(1);

                const elapsedSec = (Date.now() - startTime) / 1000;
                const speedMBs = elapsedSec > 0 ? ((uploadedBytes / (1024 * 1024)) / elapsedSec).toFixed(2) : '0';

                uploadPercent.textContent = `${progressPct}%`;
                uploadProgressBar.style.width = `${progressPct}%`;
                uploadStatusText.textContent = `Uploading chunk ${i + 1} of ${totalChunks}...`;
                uploadSpeedText.textContent = `${speedMBs} MB/s`;
            }

            uploadStatusText.textContent = 'Validating & finalizing file...';
            const compRes = await fetch(`${backendUrl}/api/upload/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ upload_id: uploadId })
            });

            if (!compRes.ok) {
                const errData = await compRes.json();
                throw new Error(errData.error || 'Chunk assembly failed');
            }

            const compData = await compRes.json();
            uploadStatusText.textContent = 'Upload Completed!';
            appendLog(`[Upload] File "${file.name}" uploaded successfully!`, 'info');

            if (!selectedVideoIds.includes(compData.video.id)) {
                selectedVideoIds.push(compData.video.id);
            }

        } catch (err) {
            alert(`Upload failed for ${file.name}: ${err.message}`);
            uploadStatusText.textContent = 'Upload Failed';
            appendLog(`[Upload Error] ${err.message}`, 'error');
        } finally {
            if (fileNum === totalFiles) {
                setTimeout(() => {
                    uploadProgressPanel.classList.add('hidden');
                    isUploading = false;
                }, 1000);
            }
        }
    }

    // --- VIDEO LIBRARY ---
    btnRefreshVideos.addEventListener('click', () => loadVideoLibrary());

    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            if (selectedVideoIds.length === availableVideos.length) {
                selectedVideoIds = [];
            } else {
                selectedVideoIds = availableVideos.map(v => v.id);
            }
            renderVideoList(availableVideos);
        });
    }

    async function loadVideoLibrary() {
        try {
            const res = await fetch(`${backendUrl}/api/videos`);
            const data = await res.json();
            availableVideos = data.videos || [];

            // Default select all videos if none selected yet
            if (selectedVideoIds.length === 0 && availableVideos.length > 0) {
                selectedVideoIds = availableVideos.map(v => v.id);
            }

            renderVideoList(availableVideos);
        } catch (err) {
            console.error('Failed to load video library:', err);
        }
    }

    function renderVideoList(videos) {
        videoListContainer.replaceChildren();

        if (selectedCountBadge) {
            selectedCountBadge.textContent = `${selectedVideoIds.length} Selected`;
        }

        if (videos.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-state';

            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-video-slash';

            const p = document.createElement('p');
            p.textContent = 'No video files uploaded yet. Upload videos above to begin building your live stream playlist!';

            emptyDiv.appendChild(icon);
            emptyDiv.appendChild(p);
            videoListContainer.appendChild(emptyDiv);
            selectedVideoIds = [];
            previewVideoName.textContent = 'No video selected';
            sourceVideoPlayer.removeAttribute('src');
            return;
        }

        videos.forEach((v) => {
            const item = document.createElement('div');
            item.className = 'video-item';
            const isChecked = selectedVideoIds.includes(v.id);
            if (isChecked) item.classList.add('selected');

            const leftDiv = document.createElement('div');
            leftDiv.className = 'video-item-left';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = v.id;
            checkbox.checked = isChecked;
            checkbox.className = 'video-radio';

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                if (checkbox.checked) {
                    if (!selectedVideoIds.includes(v.id)) selectedVideoIds.push(v.id);
                    item.classList.add('selected');
                } else {
                    selectedVideoIds = selectedVideoIds.filter(id => id !== v.id);
                    item.classList.remove('selected');
                }
                updatePreviewAndBadge();
            });

            item.addEventListener('click', () => {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            });

            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-file-video video-icon';

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'video-details';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'video-title';
            titleSpan.textContent = v.name;

            const metaSpan = document.createElement('span');
            metaSpan.className = 'video-meta';
            metaSpan.textContent = `${v.size_mb} MB • ${new Date(v.created_at * 1000).toLocaleTimeString()}`;

            detailsDiv.appendChild(titleSpan);
            detailsDiv.appendChild(metaSpan);

            leftDiv.appendChild(checkbox);
            leftDiv.appendChild(icon);
            leftDiv.appendChild(detailsDiv);

            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn-delete';
            btnDelete.title = 'Delete video';

            const delIcon = document.createElement('i');
            delIcon.className = 'fa-solid fa-trash';
            btnDelete.appendChild(delIcon);

            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete video "${v.name}"?`)) {
                    deleteVideo(v.id);
                }
            });

            item.appendChild(leftDiv);
            item.appendChild(btnDelete);
            videoListContainer.appendChild(item);
        });

        updatePreviewAndBadge();
    }

    function updatePreviewAndBadge() {
        if (selectedCountBadge) {
            selectedCountBadge.textContent = `${selectedVideoIds.length} Selected`;
        }

        if (selectedVideoIds.length > 0) {
            const firstSel = availableVideos.find(v => v.id === selectedVideoIds[0]);
            if (firstSel) {
                previewVideoName.textContent = selectedVideoIds.length === 1
                    ? firstSel.name
                    : `Playlist (${selectedVideoIds.length} videos starting with ${firstSel.name})`;
                sourceVideoPlayer.src = `${backendUrl}/api/video/file/${firstSel.id}`;
            }
        } else {
            previewVideoName.textContent = 'No videos selected for playlist';
            sourceVideoPlayer.removeAttribute('src');
        }
    }

    async function deleteVideo(id) {
        try {
            const res = await fetch(`${backendUrl}/api/videos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                selectedVideoIds = selectedVideoIds.filter(vid => vid !== id);
                loadVideoLibrary();
            }
        } catch (err) {
            alert('Failed to delete video.');
        }
    }


    // --- STREAM KEY TOGGLE ---
    btnToggleKeyVisibility.addEventListener('click', () => {
        if (streamKeyInput.type === 'password') {
            streamKeyInput.type = 'text';
            eyeIcon.className = 'fa-solid fa-eye-slash';
        } else {
            streamKeyInput.type = 'password';
            eyeIcon.className = 'fa-solid fa-eye';
        }
    });


    // --- STREAM CONTROLS ---
    btnStartStream.addEventListener('click', async () => {
        if (selectedVideoIds.length === 0) {
            alert('Please select at least 1 video checkbox to build your stream playlist.');
            return;
        }

        const streamKey = streamKeyInput.value.trim();
        if (!streamKey) {
            alert('Please enter your YouTube Stream Key.');
            streamKeyInput.focus();
            return;
        }

        const mode = document.querySelector('input[name="playbackMode"]:checked').value;
        const preset = presetSelect.value;
        const audio = audioSelect.value;

        btnStartStream.disabled = true;
        btnStartStream.textContent = 'STARTING PLAYLIST STREAM...';

        try {
            const res = await fetch(`${backendUrl}/api/stream/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video_ids: selectedVideoIds,
                    stream_key: streamKey,
                    mode: mode,
                    preset: preset,
                    audio: audio
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to start stream');
            }

            appendLog(`[Stream] ${data.message}`, 'info');
            btnStartStream.classList.add('hidden');
            btnStopStream.classList.remove('hidden');

        } catch (err) {
            alert(`Stream Error: ${err.message}`);
            appendLog(`[Stream Error] ${err.message}`, 'error');
        } finally {
            btnStartStream.disabled = false;
            btnStartStream.replaceChildren();

            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-tower-broadcast';
            btnStartStream.appendChild(icon);
            btnStartStream.appendChild(document.createTextNode(' START YOUTUBE LIVE STREAM'));
        }
    });

    btnStopStream.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to stop the YouTube Live playlist stream?')) return;

        btnStopStream.disabled = true;
        btnStopStream.textContent = 'STOPPING...';

        try {
            const res = await fetch(`${backendUrl}/api/stream/stop`, { method: 'POST' });
            const data = await res.json();
            appendLog(`[Stream] ${data.message}`, 'info');
        } catch (err) {
            alert('Failed to send stop command.');
        } finally {
            btnStopStream.disabled = false;
            btnStopStream.replaceChildren();

            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-power-off';
            btnStopStream.appendChild(icon);
            btnStopStream.appendChild(document.createTextNode(' STOP LIVE BROADCAST'));
        }
    });


    // --- STATUS POLLING ---
    function startStatusPolling() {
        statusPollInterval = setInterval(async () => {
            try {
                const res = await fetch(`${backendUrl}/api/stream/status`);
                if (!res.ok) {
                    if (backendConnStatus) {
                        backendConnStatus.className = 'conn-status-badge disconnected';
                        backendConnStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Disconnected';
                    }
                    return;
                }
                if (backendConnStatus) {
                    backendConnStatus.className = 'conn-status-badge connected';
                    backendConnStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Connected';
                }

                const status = await res.json();
                updateUIWithStatus(status);
            } catch (err) {
                if (backendConnStatus) {
                    backendConnStatus.className = 'conn-status-badge disconnected';
                    backendConnStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Disconnected';
                }
            }
        }, 1500);
    }

    function updateUIWithStatus(data) {
        if (data.is_running) {
            navLiveIndicator.className = 'live-pill live';
            navLiveText.textContent = 'LIVE ON YOUTUBE';
            liveStatusBadge.className = 'status-badge streaming';
            liveStatusBadge.textContent = 'LIVE';

            btnStartStream.classList.add('hidden');
            btnStopStream.classList.remove('hidden');

            const secs = data.elapsed_seconds || 0;
            const timeStr = formatSeconds(secs);
            navTimer.textContent = timeStr;
            metricUptime.textContent = timeStr;
            metricMode.textContent = (data.mode || 'loop').toUpperCase();

            if (data.stats) {
                metricBitrate.textContent = data.stats.bitrate || '0 kbits/s';
                metricFPS.textContent = `${data.stats.fps || 0} FPS`;
            }
        } else {
            navLiveIndicator.className = 'live-pill idle';
            navLiveText.textContent = 'OFFLINE';
            liveStatusBadge.className = 'status-badge idle';
            liveStatusBadge.textContent = 'IDLE';

            btnStartStream.classList.remove('hidden');
            btnStopStream.classList.add('hidden');

            navTimer.textContent = '00:00:00';
            metricUptime.textContent = '00:00:00';
            metricBitrate.textContent = '0 kbits/s';
            metricFPS.textContent = '0 FPS';
        }
    }

    function formatSeconds(sec) {
        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }


    // --- SSE LOG STREAM ---
    function initSSELogs() {
        if (sseSource) sseSource.close();
        sseSource = new EventSource(`${backendUrl}/api/stream/logs`);

        sseSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.log) {
                    appendLog(data.log);
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        sseSource.onerror = () => {
            // Auto reconnects
        };
    }

    function appendLog(msg, type = 'normal') {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        line.textContent = msg;
        logConsole.appendChild(line);

        if (chkAutoScroll.checked) {
            logConsole.scrollTop = logConsole.scrollHeight;
        }
    }

    btnClearLogs.addEventListener('click', () => {
        logConsole.replaceChildren();
    });


    // --- YOUTUBE EMBED ---
    btnLoadEmbed.addEventListener('click', () => {
        const inputVal = youtubeEmbedInput.value.trim();
        if (!inputVal) return;

        let videoId = inputVal;
        if (inputVal.includes('v=')) {
            videoId = inputVal.split('v=')[1].split('&')[0];
        } else if (inputVal.includes('youtu.be/')) {
            videoId = inputVal.split('youtu.be/')[1].split('?')[0];
        }

        youtubeEmbedContainer.replaceChildren();
        const iframe = document.createElement('iframe');
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
        iframe.title = 'YouTube Live Broadcast';
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        youtubeEmbedContainer.appendChild(iframe);
    });


    // --- GUIDE MODAL ---
    btnSetupGuide.addEventListener('click', () => guideModal.classList.remove('hidden'));
    btnCloseGuide.addEventListener('click', () => guideModal.classList.add('hidden'));
    btnGotIt.addEventListener('click', () => guideModal.classList.add('hidden'));

});
