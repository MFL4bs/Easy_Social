# Easy Social - Multi-Platform Social Media Manager

A single codebase to manage Facebook, Instagram, Twitter/X, and TikTok with automated posting, scheduling, analytics, and CSV/PDF export.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend    │────▶│  PostgreSQL  │
│  (React +   │     │  (Node.js +  │     │             │
│   Tailwind) │     │   Express)   │     │  + Redis    │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────┴───────┐
                    │  Platform    │
                    │  Adapters    │
                    ├──────────────┤
                    │ • Facebook   │
                    │ • Instagram  │
                    │ • Twitter    │
                    │ • TikTok     │
                    └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Recharts, react-big-calendar |
| **Backend** | Node.js 20, Express, TypeScript, TypeORM |
| **Database** | PostgreSQL 16 |
| **Queue/Cache** | Redis 7 |
| **Scheduler** | node-cron (runs every minute) |
| **Containerization** | Docker + Docker Compose |

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- API credentials for the platforms you want to connect

### 1. Clone and configure

```bash
git clone <repo-url> easy-social
cd easy-social
```

### 2. Set environment variables

Create a `.env` file in the project root (or use the one in `backend/.env`):

```bash
# Required for authentication
JWT_SECRET=your-secure-random-string

# Facebook / Instagram (Meta App)
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret

# Twitter / X (OAuth 2.0)
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret

# TikTok
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
```

### 3. Start all services

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **Backend API** on port 3000
- **Frontend** on port 80

### 4. Open the app

Navigate to [http://localhost](http://localhost)

Register a new account, then connect your social media accounts from the Settings page.

## Development (without Docker)

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` requests to `http://localhost:3000`.

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user profile |
| GET | `/api/auth/:platform/connect` | Get OAuth URL for platform |
| GET | `/api/auth/:platform/callback` | OAuth callback handler |
| DELETE | `/api/auth/:platform/disconnect` | Disconnect platform |

### Content Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/content` | List content (with filters) |
| GET | `/api/content/calendar` | Calendar view of scheduled items |
| POST | `/api/content` | Create content |
| PUT | `/api/content/:id` | Update content |
| POST | `/api/content/:id/approve` | Approve content |
| POST | `/api/content/:id/publish-now` | Publish immediately |
| DELETE | `/api/content/:id` | Delete content |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/dashboard` | Dashboard overview |
| GET | `/api/analytics/:platform` | Platform-specific analytics |
| GET | `/api/analytics/export/csv` | Export as CSV |
| GET | `/api/analytics/export/pdf` | Export as PDF |

## Platform Adapters

Each platform is implemented as a `PlatformAdapter` with a common interface:

```typescript
interface PlatformAdapter {
  platform: string;
  exchangeCode(code, redirectUri): Promise<TokenData>;
  refreshToken(token): Promise<TokenData>;
  getAccountInfo(accessToken): Promise<AccountInfo>;
  postContent(account, content): Promise<PostResult>;
  getAnalytics(account, since, until): Promise<AnalyticsData>;
  getPostAnalytics(account, postId): Promise<AnalyticsData>;
  validateToken(accessToken): Promise<boolean>;
}
```

To add a new platform:
1. Create a new file in `backend/src/platforms/` implementing `PlatformAdapter`
2. Register it in `PlatformRegistry.ts`
3. Add OAuth URL generation in `backend/src/api/auth.ts`

## Project Structure

```
easy-social/
├── backend/
│   ├── src/
│   │   ├── api/           # REST API routes
│   │   ├── auth/          # OAuth helpers
│   │   ├── config/        # Database config
│   │   ├── middleware/     # Auth middleware
│   │   ├── models/        # TypeORM entities
│   │   ├── platforms/     # Platform adapters
│   │   ├── scheduler/     # Publishing worker
│   │   └── index.ts       # Server entry point
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── services/      # API client
│   │   ├── App.tsx        # Main app with routing
│   │   └── main.tsx       # Entry point
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

## Acceptance Criteria Coverage

1. **Connect accounts in under 2 minutes** – OAuth flow with pre-built URLs; user clicks "Connect", authorizes, and is redirected back. No manual token entry.

2. **Scheduled content publishes at exact time** – `node-cron` runs every minute, picks up approved/scheduled content where `scheduledAt <= now()`, and publishes via the platform adapters.

3. **Dashboard updates within 5 minutes** – Analytics are fetched live from platform APIs on dashboard load. CSV/PDF exports use the same data source, ensuring reports match on-screen metrics.

## License

MIT