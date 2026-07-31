# 🚀 Deploying Backend to Bunnyshell.com via GitHub

This guide details how to deploy your **YouTube Live Streaming Backend** to **Bunnyshell.com** using your GitHub repository and automatic Docker build with FFmpeg.

---

## 📋 Prerequisites Checklist

- [x] `Dockerfile` (Installs Linux FFmpeg, Gunicorn, Python Flask)
- [x] `bunnyshell.yaml` (Bunnyshell Environment Definition)
- [x] `requirements.txt` (Python backend dependencies)
- [ ] GitHub Repository pushed with latest files

---

## STEP 1: Push Code to GitHub

Open PowerShell in your project folder (`C:\Users\deep1\.gemini\antigravity-ide\scratch\youtube-live-streamer`) and push the new Bunnyshell configurations:

```powershell
git add .
git commit -m "Add Bunnyshell configuration and Docker setup"
git push origin main
```

*(If you haven't initialized Git yet, run: `git init`, `git add .`, `git commit -m "Initial commit"`, link your GitHub repo with `git remote add origin https://github.com/YOUR_USERNAME/youtube-live-streamer.git`, then `git push -u origin main`)*.

---

## STEP 2: Connect GitHub Repo to Bunnyshell.com

1. Log into your [Bunnyshell Dashboard](https://environments.bunnyshell.com/).
2. In the left navigation menu, click **Integrations** &gt; **Git Integrations**.
3. Click **Connect Account** under **GitHub** and grant access to your `youtube-live-streamer` repository.

---

## STEP 3: Create & Deploy Bunnyshell Environment

1. In Bunnyshell, click **Environments** in the left sidebar ➔ Click **Create Environment** (or **+ New Environment**).
2. Select **From Repository** (or **From Git**).
3. Select your repository: `youtube-live-streamer` and main branch.
4. Bunnyshell will automatically detect `bunnyshell.yaml` and `Dockerfile` in your root folder!
5. Click **Deploy Environment**.
6. Bunnyshell will build your Docker container with FFmpeg and provision a live Kubernetes HTTPS endpoint.

---

## STEP 4: Connect Bunnyshell Backend to Cloudflare Pages Frontend

1. Once deployment is complete in Bunnyshell, copy your generated **Component URL / Hostname** (e.g. `https://youtube-live-backend-xxxx.bunnyshell.com`).
2. Open your live Cloudflare Pages frontend:
   👉 **[https://youtube-live-studio.pages.dev](https://youtube-live-studio.pages.dev)**
3. Paste your Bunnyshell URL into the **Render / Bunnyshell Backend URL** field at the top and click **Save & Connect**.
4. The connection indicator will light up green (**Connected**)!

---

### 🌐 Live Architecture Overview

```
 ┌─────────────────────────────────────────────────┐
 │     Cloudflare Pages (Global CDN Static)        │
 │     https://youtube-live-studio.pages.dev       │
 └────────────────────────┬────────────────────────┘
                          │ HTTPS / REST / SSE Stream
 ┌────────────────────────▼────────────────────────┐
 │         Bunnyshell.com Cloud Environment        │
 │  - Kubernetes Container (Python 3.11 + FFmpeg)  │
 │  - Gunicorn Server (0.0.0.0:10000)              │
 │  - 2GB Chunked Uploads & Stream Controller      │
 └────────────────────────┬────────────────────────┘
                          │ RTMP Protocol
                          ▼
        ┌──────────────────────────────────┐
        │   YouTube Live RTMP Servers      │
        │  rtmp://a.rtmp.youtube.com/live2 │
        └──────────────────────────────────┘
```
