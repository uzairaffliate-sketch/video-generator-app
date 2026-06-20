# 🎬 AI Video Generator — GitHub Actions

Script se professional voiceover aur Ken Burns effect video banao — **100% Free!**

## ✅ Kya Free Hai?

| Feature | Tool | Cost |
|---------|------|------|
| Frontend | Next.js (localhost) | Free |
| Video Render | GitHub Actions (2000 min/month) | Free |
| Voice | gTTS (Google TTS) | Free |
| Images | Google Drive Public Folder | Free |
| Database | PostgreSQL (local) | Free |
| FFmpeg | GitHub Actions Ubuntu | Free |

---

## 🚀 Setup (Sirf Ek Baar)

### Step 1: GitHub Token Banao

1. GitHub.com → Settings → Developer Settings
2. Personal Access Tokens → Fine-grained tokens → Generate new token
3. Repository access: `uzairaffliate-sketch/video-generator-app`
4. Permissions: **Actions → Read & Write**
5. Token copy karo

### Step 2: .env File Update Karo

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
GITHUB_TOKEN=ghp_your_actual_token_here
GITHUB_REPO=uzairaffliate-sketch/video-generator-app
```

### Step 3: Repo Push Karo

```bash
git init
git add .
git commit -m "Initial commit - AI Video Generator"
git remote add origin https://github.com/uzairaffliate-sketch/video-generator-app.git
git push -u origin main
```

### Step 4: App Chalao

```bash
npm install
npm run dev
```

Browser mein kholein: `http://localhost:3000`

---

## 📱 App Use Karna

1. **Script paste karo** — textarea mein apni poori script
2. **Language select karo** — English, Urdu, Hindi, etc.
3. **Drive link paste karo** — Public Google Drive folder URL
4. **Preview Match** — Script aur images ka preview dekho
5. **Generate Video** click karo
6. **Wait karo** — GitHub Actions 15-20 min mein video banayega
7. **Download karo** — ZIP download karo, MP4 andar hoga

---

## 🖼️ Image Naming Best Practices

Image filenames script ke keywords se match honge:

```
✅ Good:
  mountain_snow_peak.jpg
  river_flowing_valley.jpg
  pakistan_independence_flag.jpg
  city_night_lights.jpg

❌ Bad:
  IMG_20230815.jpg
  DSC_0042.jpg
  photo1.jpg
```

---

## ⚙️ Ken Burns Settings (Gemini Recommended)

```
Codec:    libx264
Bitrate:  4000k (Crystal clear 1080p)
FPS:      25 (16% less CPU load vs 30fps)
Preset:   faster (Speed + compression balance)
Tune:     stillimage (50% smaller file size!)
Threads:  4 (EliteBook ke 4 cores use karo)
```

---

## 📊 Performance Estimates

| Video Length | Images | Render Time | File Size |
|-------------|--------|-------------|-----------|
| 1 min | 12 | ~2 min | ~35 MB |
| 5 min | 60 | ~8 min | ~175 MB |
| 20 min | 240 | ~15-18 min | ~400 MB |

---

## 🔧 Troubleshooting

**Error: GITHUB_TOKEN not configured**
→ `.env` mein token add karo

**Error: No images found**
→ Google Drive folder ko public karo (Anyone with link → Viewer)

**Error: Workflow not found**
→ `.github/workflows/generate-video.yml` repo mein push karo

**Video quality poor**
→ Image filenames mein better keywords use karo
