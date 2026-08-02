import * as BunnySDK from "@bunny.net/edgescript-sdk";

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YouTube Live Stream Studio Pro - Playlist & 2GB Video Engine</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body class="dark-theme">

    <header class="app-header">
        <div class="header-container">
            <div class="brand">
                <i class="fa-brands fa-youtube brand-icon"></i>
                <div class="brand-text">
                    <span class="brand-name">Stream Studio <span class="badge-pro">PLAYLIST PRO</span></span>
                    <span class="brand-sub">Multi-Video YouTube Live Looper</span>
                </div>
            </div>

            <div class="header-status">
                <div id="navLiveIndicator" class="live-pill idle">
                    <span class="pulse-dot"></span>
                    <span id="navLiveText">OFFLINE</span>
                </div>
                <div class="stat-mini">
                    <i class="fa-regular fa-clock"></i>
                    <span id="navTimer">00:00:00</span>
                </div>
                <button id="btnSetupGuide" class="btn-secondary btn-sm">
                    <i class="fa-solid fa-circle-question"></i> Guide
                </button>
            </div>
        </div>
    </header>

    <main class="app-main">

        <div class="backend-config-bar glass-card">
            <div class="config-bar-inner">
                <div class="config-bar-label">
                    <i class="fa-solid fa-server text-cyan"></i>
                    <span>Backend URL:</span>
                </div>
                <div class="config-bar-input-wrapper">
                    <input type="text" id="backendUrlInput" placeholder="http://129.159.224.103" autocomplete="off">
                    <button id="btnSaveBackendUrl" class="btn-primary btn-sm">Save & Connect</button>
                </div>
                <div id="backendConnStatus" class="conn-status-badge disconnected">
                    <i class="fa-solid fa-circle-dot"></i> Not Connected
                </div>
            </div>
        </div>

        <div class="grid-container">

            <section class="column left-column">

                <div class="card glass-card">
                    <div class="card-header">
                        <h2><i class="fa-solid fa-cloud-arrow-up"></i> Video Upload Center</h2>
                        <span class="badge-info">Up to 2GB File Size</span>
                    </div>

                    <div id="dropZone" class="drop-zone">
                        <input type="file" id="videoFileInput" accept=".mp4,.mkv,.mov,.avi,.webm" class="file-input-hidden" multiple>
                        <div class="drop-zone-content">
                            <div class="upload-icon-wrapper">
                                <i class="fa-solid fa-film"></i>
                            </div>
                            <h3>Drag & Drop video files here</h3>
                            <p class="drop-subtitle">Supports MP4, MKV, MOV, AVI, WEBM (Chunked 2GB Max)</p>
                            <button id="btnBrowse" class="btn-primary btn-md">
                                <i class="fa-solid fa-folder-open"></i> Select Video Files
                            </button>
                        </div>
                    </div>

                    <div id="uploadProgressPanel" class="upload-progress-panel hidden">
                        <div class="progress-info-row">
                            <span id="uploadFileName" class="file-name-text">video.mp4</span>
                            <span id="uploadPercent" class="percent-text">0%</span>
                        </div>
                        <div class="progress-bar-container">
                            <div id="uploadProgressBar" class="progress-bar-fill" style="width: 0%;"></div>
                        </div>
                        <div class="progress-meta-row">
                            <span id="uploadStatusText">Initializing chunked upload...</span>
                            <span id="uploadSpeedText">0 MB/s</span>
                        </div>
                    </div>
                </div>

                <div class="card glass-card">
                    <div class="card-header">
                        <h2>
                            <i class="fa-solid fa-list-check"></i> Video Playlist Library 
                            <span id="selectedCountBadge" class="badge-pro" style="background:#06B6D4; margin-left:8px;">0 Selected</span>
                        </h2>
                        <div class="library-header-actions">
                            <button id="btnSelectAll" class="btn-secondary btn-sm" title="Select / Unselect All">Select All</button>
                            <button id="btnRefreshVideos" class="btn-icon" title="Refresh Library">
                                <i class="fa-solid fa-rotate"></i>
                            </button>
                        </div>
                    </div>

                    <div id="videoListContainer" class="video-list-container">
                        <div class="empty-state">
                            <i class="fa-solid fa-video-slash"></i>
                            <p>No video files uploaded yet. Upload videos above to begin building your live stream playlist!</p>
                        </div>
                    </div>
                </div>

                <div class="card glass-card highlight-border">
                    <div class="card-header">
                        <h2><i class="fa-solid fa-sliders"></i> YouTube Broadcast Config</h2>
                    </div>

                    <div class="form-group">
                        <label for="streamKeyInput">
                            YouTube Stream Key <span class="required">*</span>
                            <i class="fa-solid fa-shield-halved tooltip-icon" title="Stream key is kept private."></i>
                        </label>
                        <div class="input-with-icon">
                            <i class="fa-solid fa-key input-prefix"></i>
                            <input type="password" id="streamKeyInput" placeholder="xxxx-xxxx-xxxx-xxxx-xxxx" autocomplete="off">
                            <button id="btnToggleKeyVisibility" class="input-suffix-btn" title="Toggle visibility">
                                <i class="fa-solid fa-eye" id="eyeIcon"></i>
                            </button>
                        </div>
                        <span class="help-text">Found in YouTube Studio &gt; Go Live &gt; Stream Key</span>
                    </div>

                    <div class="form-group">
                        <label>Playlist Playback Mode <span class="required">*</span></label>
                        <div class="mode-selector">
                            <label class="mode-option selected" id="lblModeLoop">
                                <input type="radio" name="playbackMode" value="loop" checked>
                                <div class="mode-card">
                                    <i class="fa-solid fa-rotate-right mode-icon"></i>
                                    <div class="mode-info">
                                        <span class="mode-title">Continuous Playlist Loop</span>
                                        <span class="mode-desc">Loops all selected playlist videos endlessly 24/7</span>
                                    </div>
                                </div>
                            </label>

                            <label class="mode-option" id="lblModeSingle">
                                <input type="radio" name="playbackMode" value="single">
                                <div class="mode-card">
                                    <i class="fa-solid fa-play mode-icon"></i>
                                    <div class="mode-info">
                                        <span class="mode-title">Single Playlist Cycle</span>
                                        <span class="mode-desc">Streams all selected videos once in sequence</span>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group col-half">
                            <label for="presetSelect">Quality / Resolution</label>
                            <select id="presetSelect" class="form-control">
                                <option value="720p60" selected>720p 60fps (Recommended)</option>
                                <option value="1080p60">1080p 60fps (High Quality)</option>
                                <option value="passthrough">Passthrough (Copy Mode)</option>
                            </select>
                        </div>

                        <div class="form-group col-half">
                            <label for="audioSelect">Audio Setting</label>
                            <select id="audioSelect" class="form-control">
                                <option value="original" selected>Original Video Audio</option>
                                <option value="mute">Mute Stream Audio</option>
                                <option value="silent">Generate Silent Audio Stream</option>
                            </select>
                        </div>
                    </div>

                    <div class="action-buttons-wrapper">
                        <button id="btnStartStream" class="btn-live-start">
                            <i class="fa-solid fa-tower-broadcast"></i> START YOUTUBE LIVE STREAM
                        </button>
                        <button id="btnStopStream" class="btn-live-stop hidden">
                            <i class="fa-solid fa-power-off"></i> STOP LIVE BROADCAST
                        </button>
                    </div>

                </div>

            </section>

            <section class="column right-column">

                <div class="card glass-card">
                    <div class="card-header">
                        <h2><i class="fa-solid fa-chart-line"></i> Live Broadcast Dashboard</h2>
                        <div id="liveStatusBadge" class="status-badge idle">IDLE</div>
                    </div>

                    <div class="metrics-grid">
                        <div class="metric-box">
                            <span class="metric-label">Uptime</span>
                            <span id="metricUptime" class="metric-value">00:00:00</span>
                        </div>
                        <div class="metric-box">
                            <span class="metric-label">Target Mode</span>
                            <span id="metricMode" class="metric-value text-cyan">LOOP</span>
                        </div>
                        <div class="metric-box">
                            <span class="metric-label">Bitrate</span>
                            <span id="metricBitrate" class="metric-value">0 kbits/s</span>
                        </div>
                        <div class="metric-box">
                            <span class="metric-label">Framerate</span>
                            <span id="metricFPS" class="metric-value">0 FPS</span>
                        </div>
                    </div>

                    <div class="preview-wrapper">
                        <div class="preview-header">
                            <span><i class="fa-solid fa-tv"></i> Active Source Preview</span>
                            <span id="previewVideoName" class="preview-filename">No video selected</span>
                        </div>
                        <div class="video-container">
                            <video id="sourceVideoPlayer" controls preload="metadata">
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>

                </div>

                <div class="card glass-card">
                    <div class="card-header">
                        <h2><i class="fa-solid fa-terminal"></i> RTMP Stream Logs & Output</h2>
                        <div class="log-actions">
                            <label class="autoscroll-toggle">
                                <input type="checkbox" id="chkAutoScroll" checked> Auto-scroll
                            </label>
                            <button id="btnClearLogs" class="btn-icon-sm" title="Clear Console">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>

                    <div id="logConsole" class="log-console">
                        <div class="log-line info">[System] Stream Studio initialized. Select videos to build playlist.</div>
                    </div>
                </div>

                <div class="card glass-card">
                    <div class="card-header">
                        <h2><i class="fa-brands fa-youtube"></i> YouTube Live Channel Embed</h2>
                    </div>

                    <div class="form-group">
                        <label for="youtubeEmbedInput">YouTube Live Video ID or URL (Optional Preview)</label>
                        <div class="input-with-icon">
                            <i class="fa-brands fa-youtube input-prefix text-red"></i>
                            <input type="text" id="youtubeEmbedInput" placeholder="e.g. jfKfPfyJRdk or https://www.youtube.com/watch?v=...">
                            <button id="btnLoadEmbed" class="input-suffix-btn text-primary">Load</button>
                        </div>
                    </div>

                    <div id="youtubeEmbedContainer" class="embed-container">
                        <div class="embed-placeholder">
                            <i class="fa-brands fa-youtube placeholder-icon"></i>
                            <p>Enter YouTube Video ID above to display live player preview</p>
                        </div>
                    </div>
                </div>

            </section>
        </div>
    </main>

    <div id="guideModal" class="modal-backdrop hidden">
        <div class="modal-box glass-card">
            <div class="modal-header">
                <h3><i class="fa-brands fa-youtube text-red"></i> Multi-Video Playlist Instructions</h3>
                <button id="btnCloseGuide" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
                <ol class="guide-steps">
                    <li>
                        <strong>Upload Videos</strong>
                        <p>Upload 1 or more videos (up to 2GB each).</p>
                    </li>
                    <li>
                        <strong>Select Playlist Checkboxes</strong>
                        <p>Check the boxes next to the videos you want in your live playlist.</p>
                    </li>
                    <li>
                        <strong>Select Loop Mode</strong>
                        <p>Select <strong>Continuous Playlist Loop</strong> to play all selected videos in sequence over and over 24/7.</p>
                    </li>
                    <li>
                        <strong>Start Stream</strong>
                        <p>Enter YouTube Stream Key and hit <strong>START YOUTUBE LIVE STREAM</strong>!</p>
                    </li>
                </ol>
            </div>
            <div class="modal-footer">
                <button id="btnGotIt" class="btn-primary">Got it!</button>
            </div>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
`;
const CSS_CONTENT = `/* --- YOUTUBE LIVE STREAM STUDIO STYLESHEET --- */

:root {
    --bg-main: #0B0F17;
    --bg-card: rgba(17, 24, 39, 0.75);
    --bg-card-hover: rgba(31, 41, 55, 0.85);
    --border-card: rgba(255, 255, 255, 0.08);
    --border-highlight: rgba(255, 0, 0, 0.4);
    
    --text-main: #F3F4F6;
    --text-muted: #9CA3AF;
    --text-dim: #6B7280;

    --youtube-red: #FF0000;
    --youtube-red-dark: #CC0000;
    --youtube-red-glow: rgba(255, 0, 0, 0.35);

    --cyan-accent: #06B6D4;
    --cyan-glow: rgba(6, 182, 212, 0.25);

    --green-live: #10B981;
    --green-glow: rgba(16, 185, 129, 0.3);

    --amber-wait: #F59E0B;
    
    --radius-lg: 16px;
    --radius-md: 10px;
    --radius-sm: 6px;

    --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body.dark-theme {
    background-color: var(--bg-main);
    background-image: 
        radial-gradient(at 0% 0%, rgba(255, 0, 0, 0.08) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(6, 182, 212, 0.08) 0px, transparent 50%);
    background-attachment: fixed;
    color: var(--text-main);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    line-height: 1.5;
}

/* --- HEADER --- */
.app-header {
    background: rgba(11, 15, 23, 0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border-card);
    position: sticky;
    top: 0;
    z-index: 100;
    padding: 12px 24px;
}

.header-container {
    max-width: 1600px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.brand {
    display: flex;
    align-items: center;
    gap: 14px;
}

.brand-icon {
    font-size: 2rem;
    color: var(--youtube-red);
    filter: drop-shadow(0 0 10px var(--youtube-red-glow));
}

.brand-name {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 8px;
}

.badge-pro {
    background: linear-gradient(135deg, var(--youtube-red), #B91C1C);
    color: #FFF;
    font-size: 0.65rem;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.05em;
}

.brand-sub {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
}

.header-status {
    display: flex;
    align-items: center;
    gap: 18px;
}

.live-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    border: 1px solid transparent;
}

.live-pill.idle {
    background: rgba(107, 114, 128, 0.15);
    color: var(--text-muted);
    border-color: rgba(107, 114, 128, 0.3);
}

.live-pill.live {
    background: rgba(16, 185, 129, 0.15);
    color: var(--green-live);
    border-color: rgba(16, 185, 129, 0.4);
    box-shadow: 0 0 12px var(--green-glow);
}

.pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: currentColor;
}

.live-pill.live .pulse-dot {
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { transform: scale(0.95); opacity: 0.7; }
    50% { transform: scale(1.3); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.7; }
}

.stat-mini {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
}

/* --- MAIN LAYOUT --- */
.app-main {
    max-width: 1600px;
    margin: 24px auto;
    padding: 0 24px;
}

/* BACKEND CONFIG BAR */
.backend-config-bar {
    margin-bottom: 24px;
    padding: 14px 20px;
}

.config-bar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
}

.config-bar-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 0.9rem;
}

.config-bar-input-wrapper {
    display: flex;
    gap: 10px;
    flex: 1;
    max-width: 600px;
}

.config-bar-input-wrapper input {
    flex: 1;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border-card);
    border-radius: var(--radius-md);
    padding: 8px 14px;
    color: #FFF;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
}

.conn-status-badge {
    font-size: 0.8rem;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.conn-status-badge.connected {
    background: rgba(16, 185, 129, 0.15);
    color: var(--green-live);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.conn-status-badge.disconnected {
    background: rgba(239, 68, 68, 0.15);
    color: #EF4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.grid-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
}

@media (max-width: 1100px) {
    .grid-container {
        grid-template-columns: 1fr;
    }
}

.column {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

/* --- GLASS CARDS --- */
.glass-card {
    background: var(--bg-card);
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-card);
    border-radius: var(--radius-lg);
    padding: 20px 24px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    transition: var(--transition);
}

.glass-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
}

.highlight-border {
    border-color: var(--border-highlight);
    box-shadow: 0 0 20px rgba(255, 0, 0, 0.1);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
}

.card-header h2 {
    font-size: 1.05rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
    color: #FFF;
}

.card-header h2 i {
    color: var(--youtube-red);
}

/* --- UPLOAD DROPZONE --- */
.drop-zone {
    border: 2px dashed rgba(255, 255, 255, 0.15);
    border-radius: var(--radius-md);
    padding: 36px 20px;
    text-align: center;
    background: rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: var(--transition);
    position: relative;
}

.drop-zone:hover, .drop-zone.dragover {
    border-color: var(--youtube-red);
    background: rgba(255, 0, 0, 0.05);
    transform: translateY(-2px);
}

.file-input-hidden {
    display: none;
}

.upload-icon-wrapper {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(255, 0, 0, 0.1);
    color: var(--youtube-red);
    font-size: 1.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 14px auto;
}

.drop-zone h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 4px;
}

.drop-subtitle {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 16px;
}

.upload-progress-panel {
    margin-top: 16px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-md);
    padding: 14px;
    border: 1px solid var(--border-card);
}

.progress-info-row, .progress-meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
}

.file-name-text {
    font-weight: 600;
    color: #FFF;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 75%;
}

.percent-text {
    font-family: 'JetBrains Mono', monospace;
    color: var(--cyan-accent);
    font-weight: 700;
}

.progress-bar-container {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    margin: 10px 0;
    overflow: hidden;
}

.progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--youtube-red), var(--cyan-accent));
    border-radius: 4px;
    transition: width 0.2s ease;
}

.progress-meta-row {
    font-size: 0.75rem;
    color: var(--text-muted);
}

/* --- VIDEO LIBRARY --- */
.video-list-container {
    max-height: 220px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.video-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-card);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    transition: var(--transition);
}

.video-item:hover, .video-item.selected {
    background: rgba(255, 0, 0, 0.08);
    border-color: rgba(255, 0, 0, 0.3);
}

.video-item-left {
    display: flex;
    align-items: center;
    gap: 12px;
    overflow: hidden;
}

.video-radio {
    accent-color: var(--youtube-red);
    width: 16px;
    height: 16px;
    cursor: pointer;
}

.video-icon {
    font-size: 1.2rem;
    color: var(--cyan-accent);
}

.video-details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.video-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #FFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.video-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.btn-delete {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    transition: var(--transition);
}

.btn-delete:hover {
    color: var(--youtube-red);
    background: rgba(255, 0, 0, 0.15);
}

.empty-state {
    text-align: center;
    padding: 24px;
    color: var(--text-dim);
}

.empty-state i {
    font-size: 2rem;
    margin-bottom: 8px;
}

/* --- STREAM CONFIG FORM --- */
.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 6px;
}

.required {
    color: var(--youtube-red);
}

.input-with-icon {
    position: relative;
    display: flex;
    align-items: center;
}

.input-prefix {
    position: absolute;
    left: 12px;
    color: var(--text-dim);
    font-size: 0.9rem;
}

.input-suffix-btn {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px 10px;
    font-size: 0.85rem;
}

.input-suffix-btn:hover {
    color: #FFF;
}

input[type="text"], input[type="password"], select.form-control {
    width: 100%;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid var(--border-card);
    border-radius: var(--radius-md);
    padding: 10px 40px 10px 36px;
    color: #FFF;
    font-family: inherit;
    font-size: 0.9rem;
    transition: var(--transition);
}

select.form-control {
    padding-left: 12px;
    padding-right: 12px;
    cursor: pointer;
}

input[type="text"]:focus, input[type="password"]:focus, select.form-control:focus {
    outline: none;
    border-color: var(--youtube-red);
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.2);
}

.help-text {
    font-size: 0.72rem;
    color: var(--text-dim);
    margin-top: 4px;
    display: block;
}

/* MODE SELECTOR */
.mode-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.mode-option input[type="radio"] {
    display: none;
}

.mode-card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border-card);
    border-radius: var(--radius-md);
    padding: 12px;
    cursor: pointer;
    transition: var(--transition);
}

.mode-option input[type="radio"]:checked + .mode-card {
    border-color: var(--youtube-red);
    background: rgba(255, 0, 0, 0.12);
}

.mode-icon {
    font-size: 1.2rem;
    color: var(--text-muted);
}

.mode-option input[type="radio"]:checked + .mode-card .mode-icon {
    color: var(--youtube-red);
}

.mode-title {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: #FFF;
}

.mode-desc {
    display: block;
    font-size: 0.7rem;
    color: var(--text-muted);
}

.form-row {
    display: flex;
    gap: 12px;
}

.col-half {
    flex: 1;
}

/* BUTTONS */
.action-buttons-wrapper {
    margin-top: 20px;
}

.btn-primary {
    background: var(--youtube-red);
    color: #FFF;
    border: none;
    border-radius: var(--radius-md);
    padding: 10px 18px;
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    transition: var(--transition);
}

.btn-primary:hover {
    background: var(--youtube-red-dark);
    box-shadow: 0 0 15px var(--youtube-red-glow);
}

.btn-secondary {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
    border: 1px solid var(--border-card);
    border-radius: var(--radius-md);
    padding: 8px 14px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: var(--transition);
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
}

.btn-sm {
    padding: 6px 12px;
    font-size: 0.8rem;
}

.btn-live-start {
    width: 100%;
    padding: 14px;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, #FF0000, #B91C1C);
    color: #FFF;
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: 0.03em;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 20px var(--youtube-red-glow);
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.btn-live-start:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(255, 0, 0, 0.5);
}

.btn-live-stop {
    width: 100%;
    padding: 14px;
    border-radius: var(--radius-md);
    background: #DC2626;
    color: #FFF;
    font-weight: 700;
    font-size: 0.95rem;
    border: none;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.btn-icon, .btn-icon-sm {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
}

.btn-icon:hover, .btn-icon-sm:hover {
    color: #FFF;
}

/* --- DASHBOARD METRICS --- */
.status-badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
}

.status-badge.idle {
    background: rgba(107, 114, 128, 0.2);
    color: var(--text-muted);
}

.status-badge.streaming {
    background: rgba(16, 185, 129, 0.2);
    color: var(--green-live);
    box-shadow: 0 0 10px var(--green-glow);
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 18px;
}

.metric-box {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border-card);
    border-radius: var(--radius-md);
    padding: 10px;
    text-align: center;
}

.metric-label {
    display: block;
    font-size: 0.7rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.metric-value {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.95rem;
    font-weight: 700;
    color: #FFF;
    margin-top: 2px;
}

.text-cyan { color: var(--cyan-accent); }
.text-red { color: var(--youtube-red); }

/* VIDEO PREVIEW */
.preview-wrapper {
    background: rgba(0, 0, 0, 0.4);
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--border-card);
}

.preview-header {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.3);
    font-size: 0.78rem;
    color: var(--text-muted);
}

.video-container video {
    width: 100%;
    max-height: 240px;
    display: block;
    background: #000;
}

/* LOG CONSOLE */
.log-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.75rem;
    color: var(--text-muted);
}

.log-console {
    background: #05070B;
    border: 1px solid var(--border-card);
    border-radius: var(--radius-md);
    padding: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    height: 180px;
    overflow-y: auto;
    color: #D1D5DB;
    line-height: 1.4;
}

.log-line {
    margin-bottom: 4px;
    word-break: break-all;
}

.log-line.info { color: var(--cyan-accent); }
.log-line.error { color: #EF4444; }

/* EMBED YOUTUBE */
.embed-container {
    margin-top: 12px;
    background: #000;
    border-radius: var(--radius-md);
    aspect-ratio: 16/9;
    overflow: hidden;
    border: 1px solid var(--border-card);
    display: flex;
    align-items: center;
    justify-content: center;
}

.embed-placeholder {
    text-align: center;
    color: var(--text-dim);
    padding: 20px;
}

.placeholder-icon {
    font-size: 2.5rem;
    color: var(--text-dim);
    margin-bottom: 8px;
}

/* MODAL */
.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-box {
    width: 90%;
    max-width: 550px;
    background: #111827;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.btn-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.5rem;
    cursor: pointer;
}

.guide-steps {
    padding-left: 20px;
}

.guide-steps li {
    margin-bottom: 14px;
}

.guide-steps p {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.modal-footer {
    margin-top: 20px;
    text-align: right;
}

.hidden {
    display: none !important;
}
`;
const JS_CONTENT = `/* --- YOUTUBE LIVE STREAM STUDIO FRONTEND ENGINE (PLAYLIST PRO EDITION) --- */

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
    let backendUrl = localStorage.getItem('renderBackendUrl');
    if (!backendUrl) {
        if (window.location.origin && window.location.origin.startsWith('http')) {
            backendUrl = window.location.origin;
        } else {
            backendUrl = 'https://signature-compliance-occasions-lucky.trycloudflare.com';
        }
    }
    backendUrl = backendUrl.replace(/\\/+$/, '');
    if (!backendUrl.startsWith('http')) backendUrl = 'http://' + backendUrl;

    if (backendUrlInput) backendUrlInput.value = backendUrl;

    let availableVideos = [];
    let selectedVideoIds = [];
    let isUploading = false;
    let sseSource = null;
    let statusPollInterval = null;

    if (btnSaveBackendUrl) {
        btnSaveBackendUrl.addEventListener('click', () => {
            let val = backendUrlInput.value.trim().replace(/\\/+$/, '');
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
            appendLog(\`[Config] Saved Backend URL: \${backendUrl}\`, 'info');

            checkBackendConnection();
            loadVideoLibrary();
            initSSELogs();
        });
    }

    async function checkBackendConnection() {
        if (!backendConnStatus) return;
        try {
            const res = await fetch(\`\${backendUrl}/api/stream/status\`);
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
            alert(\`File "\${file.name}" exceeds 2GB maximum size limit.\`);
            return;
        }

        isUploading = true;
        uploadProgressPanel.classList.remove('hidden');
        uploadFileName.textContent = \`[\${fileNum}/\${totalFiles}] \${file.name}\`;
        uploadPercent.textContent = '0%';
        uploadProgressBar.style.width = '0%';
        uploadStatusText.textContent = 'Initializing chunked upload...';
        uploadSpeedText.textContent = '0 MB/s';

        try {
            const initRes = await fetch(\`\${backendUrl}/api/upload/init\`, {
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

                const chunkRes = await fetch(\`\${backendUrl}/api/upload/chunk\`, {
                    method: 'POST',
                    body: formData
                });

                if (!chunkRes.ok) {
                    throw new Error(\`Failed chunk \${i + 1} of \${totalChunks}\`);
                }

                uploadedBytes += (end - start);
                const progressPct = ((uploadedBytes / file.size) * 100).toFixed(1);

                const elapsedSec = (Date.now() - startTime) / 1000;
                const speedMBs = elapsedSec > 0 ? ((uploadedBytes / (1024 * 1024)) / elapsedSec).toFixed(2) : '0';

                uploadPercent.textContent = \`\${progressPct}%\`;
                uploadProgressBar.style.width = \`\${progressPct}%\`;
                uploadStatusText.textContent = \`Uploading chunk \${i + 1} of \${totalChunks}...\`;
                uploadSpeedText.textContent = \`\${speedMBs} MB/s\`;
            }

            uploadStatusText.textContent = 'Validating & finalizing file...';
            const compRes = await fetch(\`\${backendUrl}/api/upload/complete\`, {
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
            appendLog(\`[Upload] File "\${file.name}" uploaded successfully!\`, 'info');

            if (!selectedVideoIds.includes(compData.video.id)) {
                selectedVideoIds.push(compData.video.id);
            }

        } catch (err) {
            alert(\`Upload failed for \${file.name}: \${err.message}\`);
            uploadStatusText.textContent = 'Upload Failed';
            appendLog(\`[Upload Error] \${err.message}\`, 'error');
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
            const res = await fetch(\`\${backendUrl}/api/videos\`);
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
            selectedCountBadge.textContent = \`\${selectedVideoIds.length} Selected\`;
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
            metaSpan.textContent = \`\${v.size_mb} MB • \${new Date(v.created_at * 1000).toLocaleTimeString()}\`;

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
                if (confirm(\`Delete video "\${v.name}"?\`)) {
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
            selectedCountBadge.textContent = \`\${selectedVideoIds.length} Selected\`;
        }

        if (selectedVideoIds.length > 0) {
            const firstSel = availableVideos.find(v => v.id === selectedVideoIds[0]);
            if (firstSel) {
                previewVideoName.textContent = selectedVideoIds.length === 1
                    ? firstSel.name
                    : \`Playlist (\${selectedVideoIds.length} videos starting with \${firstSel.name})\`;
                sourceVideoPlayer.src = \`\${backendUrl}/api/video/file/\${firstSel.id}\`;
            }
        } else {
            previewVideoName.textContent = 'No videos selected for playlist';
            sourceVideoPlayer.removeAttribute('src');
        }
    }

    async function deleteVideo(id) {
        try {
            const res = await fetch(\`\${backendUrl}/api/videos/\${id}\`, { method: 'DELETE' });
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
            const res = await fetch(\`\${backendUrl}/api/stream/start\`, {
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

            appendLog(\`[Stream] \${data.message}\`, 'info');
            btnStartStream.classList.add('hidden');
            btnStopStream.classList.remove('hidden');

        } catch (err) {
            alert(\`Stream Error: \${err.message}\`);
            appendLog(\`[Stream Error] \${err.message}\`, 'error');
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
            const res = await fetch(\`\${backendUrl}/api/stream/stop\`, { method: 'POST' });
            const data = await res.json();
            appendLog(\`[Stream] \${data.message}\`, 'info');
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
                const res = await fetch(\`\${backendUrl}/api/stream/status\`);
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
                metricFPS.textContent = \`\${data.stats.fps || 0} FPS\`;
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
        return \`\${h}:\${m}:\${s}\`;
    }


    // --- SSE LOG STREAM ---
    function initSSELogs() {
        if (sseSource) sseSource.close();
        sseSource = new EventSource(\`\${backendUrl}/api/stream/logs\`);

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
        line.className = \`log-line \${type}\`;
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
        iframe.src = \`https://www.youtube-nocookie.com/embed/\${encodeURIComponent(videoId)}?autoplay=1\`;
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
`;

BunnySDK.net.http.serve(async (request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/" || path === "/index.html") {
    return new Response(HTML_CONTENT, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Powered-By": "Bunny.net Edge Scripting"
      }
    });
  }

  if (path === "/style.css") {
    return new Response(CSS_CONTENT, {
      status: 200,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "X-Powered-By": "Bunny.net Edge Scripting"
      }
    });
  }

  if (path === "/app.js") {
    return new Response(JS_CONTENT, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "X-Powered-By": "Bunny.net Edge Scripting"
      }
    });
  }

  return new Response("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
});
