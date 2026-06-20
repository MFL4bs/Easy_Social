<div align="center">

# 🚀 Easy Social

### Multi-Platform Social Media Manager

Manage Facebook, Instagram, Twitter/X and TikTok from a single dashboard.
Schedule posts, track analytics, and export reports — all in one place.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](https://docker.com)

</div>

---

## ✨ Features

- 🔗 **Connect accounts** via OAuth 2.0 — Facebook, Instagram, Twitter/X, TikTok
- 📝 **Create & schedule content** with image/video upload support
- 📅 **Visual calendar** to manage your content pipeline
- 📊 **Analytics dashboard** with charts per platform
- 📤 **Export reports** as CSV or PDF
- ⏰ **Auto-publish** — scheduler runs every minute to publish on time
- 🐳 **Docker ready** — single command to run everything

---

## 🖥️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| **Backend** | Node.js 20, Express, TypeScript, TypeORM |
| **Database** | SQLite (via better-sqlite3) |
| **Scheduler** | node-cron |
| **Containerization** | Docker + Docker Compose |

---

## 🚀 Quick Start

### With Docker (recommended)

```bash
# 1. Clone the repo
git clone https://github.com/MFL4bs/Easy_Social.git
cd Easy_Social

# 2. Configure environment
cp .env.example .env
# Edit .env and set your JWT_SECRET and platform credentials

# 3. Build and run
docker-compose up -d --build

# 4. Open the app
open http://localhost
```

### Without Docker (development)

**Backend:**
```bash
cd backend
npm install
npm run dev
# API running on http://localhost:3000
```

**Frontend** (new terminal):
```bash
cd frontend
npm install
npm run dev
# App running on http://localhost:5173
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```env
# Required
JWT_SECRET=your-secure-random-string

# Facebook / Instagram
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# Twitter / X
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=

# TikTok
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

### Getting API credentials

| Platform | Developer Portal |
|----------|-----------------|
| Facebook & Instagram | [developers.facebook.com](https://developers.facebook.com) |
| Twitter / X | [developer.twitter.com](https://developer.twitter.com) |
| TikTok | [developers.tiktok.com](https://developers.tiktok.com) |

**Callback URLs to configure in each platform:**
```
http://localhost:3000/api/auth/facebook/callback
http://localhost:3000/api/auth/twitter/callback
http://localhost:3000/api/auth/tiktok/callback
```

---

## 📁 Project Structure

```
Easy_Social/
├── backend/
│   ├── src/
│   │   ├── api/            # REST API routes
│   │   ├── config/         # Database config (SQLite)
│   │   ├── middleware/      # JWT auth middleware
│   │   ├── models/         # TypeORM entities
│   │   ├── platforms/      # Platform adapters (FB, IG, TW, TT)
│   │   └── scheduler/      # Auto-publish worker (node-cron)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/          # Dashboard, Content, Calendar, Analytics, Settings
│   │   ├── services/       # Axios API client
│   │   └── App.tsx
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/auth/me` | Current user + connected accounts |
| `GET` | `/api/auth/:platform/connect` | Get OAuth URL |
| `GET` | `/api/auth/:platform/callback` | OAuth callback |
| `DELETE` | `/api/auth/:platform/disconnect` | Disconnect account |

### Content
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/content` | List content (filterable) |
| `GET` | `/api/content/calendar` | Calendar view |
| `POST` | `/api/content` | Create content |
| `PUT` | `/api/content/:id` | Update content |
| `POST` | `/api/content/:id/approve` | Approve for publishing |
| `POST` | `/api/content/:id/publish-now` | Publish immediately |
| `DELETE` | `/api/content/:id` | Delete content |
| `POST` | `/api/upload` | Upload media files |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/dashboard` | Overview + timeline |
| `GET` | `/api/analytics/:platform` | Per-platform analytics |
| `GET` | `/api/analytics/export/csv` | Export as CSV |
| `GET` | `/api/analytics/export/pdf` | Export as PDF |

---

## 🧩 Adding a New Platform

1. Create `backend/src/platforms/YourPlatformAdapter.ts` implementing `PlatformAdapter`:

```typescript
interface PlatformAdapter {
  platform: string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenData>;
  refreshToken(token: string): Promise<TokenData>;
  getAccountInfo(accessToken: string): Promise<AccountInfo>;
  postContent(account: ConnectedAccount, content: ContentItem): Promise<PostResult>;
  getAnalytics(account: ConnectedAccount, since: Date, until: Date): Promise<AnalyticsData>;
  validateToken(accessToken: string): Promise<boolean>;
}
```

2. Register it in `PlatformRegistry.ts`
3. Add the OAuth URL in `api/auth.ts`

---

## ☁️ Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Select this repository
4. Set environment variables from `.env.example`
5. Railway auto-detects `docker-compose.yml` and deploys

---

## 📄 License

MIT © [MFL4bs](https://github.com/MFL4bs)
