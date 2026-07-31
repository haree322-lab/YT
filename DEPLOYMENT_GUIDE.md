# 🚀 YouTube Live Stream Studio - Deployment Guide (Cloudflare Pages + Render.com)

This guide walks you through deploying your **YouTube Live Streaming Web Application** for free:
- **Backend on Render.com**: Runs Python Flask + Docker + FFmpeg for RTMP streaming.
- **Frontend on Cloudflare Pages**: Hosts the static web UI on Cloudflare's ultra-fast global CDN.

---

## 📁 Repository Structure Overview

```
youtube-live-streamer/
├── app.py                 # Backend Flask API & FFmpeg Process Manager
├── Dockerfile             # Multi-stage Linux Docker build with FFmpeg
├── requirements.txt       # Python backend dependencies
├── render.yaml            # Render Blueprint Infrastructure file
├── DEPLOYMENT_GUIDE.md    # Deployment instructions (this file)
└── frontend/              # Target folder for Cloudflare Pages
    ├── index.html         # Frontend HTML UI
    ├── style.css          # Dark glassmorphic styling
    ├── app.js             # API Client & SSE Real-time Logs Listener
    └── _headers           # Cloudflare Pages security & CORS headers
```

---

## STEP 1: Push Code to GitHub

1. Open your terminal in the project directory:
   ```bash
   cd C:\Users\deep1\.gemini\antigravity-ide\scratch\youtube-live-streamer
   ```
2. Initialize Git and commit all files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Cloudflare Pages & Render deployment"
   ```
3. Create a new repository on [GitHub.com](https://github.com/new) named `youtube-live-streamer`.
4. Link and push your code:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/youtube-live-streamer.git
   git branch -M main
   git push -u origin main
   ```

---

## STEP 2: Deploy Backend to Render.com

1. Log into your [Render.com Dashboard](https://dashboard.render.com/).
2. Click **New +** &gt; **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your `youtube-live-streamer` GitHub repo.
4. Configure the service settings:
   - **Name**: `youtube-live-backend`
   - **Language / Environment**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: `Free`
5. Click **Create Web Service**.
6. Render will automatically build the Docker container, install Linux FFmpeg, and launch your Gunicorn server.
7. Once deployment finishes, copy your live backend URL from the top of the Render dashboard:
   `https://youtube-live-backend.onrender.com`

---

## STEP 3: Deploy Frontend to Cloudflare Pages

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation bar, go to **Workers & Pages** &gt; **Create application** &gt; **Pages** tab.
3. Select **Connect to Git** and pick your `youtube-live-streamer` repository.
4. Configure Build settings:
   - **Project Name**: `youtube-live-studio`
   - **Production Branch**: `main`
   - **Framework Preset**: `None`
   - **Build Output Directory**: `frontend`
5. Click **Save and Deploy**.
6. Cloudflare will deploy your static site globally in seconds and provide your live frontend URL:
   `https://youtube-live-studio.pages.dev`

---

## STEP 4: Connect Cloudflare Frontend to Render Backend

1. Open your published Cloudflare Pages URL (`https://youtube-live-studio.pages.dev`).
2. At the top of the app, locate the **Render Backend URL** configuration bar.
3. Paste your Render backend URL (`https://youtube-live-backend.onrender.com`).
4. Click **Save & Connect**.
5. The connection badge will turn green (**Connected**)!

---

## 🎉 You're All Set!

You can now drag & drop video files up to 2GB, select **Continuous Loop** or **Single Play**, enter your YouTube Stream Key, and broadcast live to YouTube from anywhere in the world!
