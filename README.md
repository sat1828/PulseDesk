<div align="center">

<img width="1400" height="520" alt="banner" src="https://github.com/user-attachments/assets/d592fdc6-d99f-4a3b-bc9a-60de0987ee39" />

<br/>
<br/>

<a href="#"><img src="https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react&logoColor=black" /></a>
<a href="#"><img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" /></a>
<a href="#"><img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" /></a>
<a href="#"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white" /></a>
<a href="#"><img src="https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white" /></a>
<a href="#"><img src="https://img.shields.io/badge/BullMQ-5.12-F97316?style=flat-square" /></a>
<a href="#"><img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" /></a>
<a href="#"><img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" /></a>
<a href="#"><img src="https://img.shields.io/badge/Framer_Motion-11.11-black?style=flat-square" /></a>
<a href="#"><img src="https://img.shields.io/badge/License-MIT-22c55e?style=flat-square" /></a>

<br/>
<br/>

**PulseDesk detects team burnout before it becomes a resignation.**

It passively monitors Slack message metadata — timing, sentiment, response latency, vocabulary shift — runs it through a Python NLP service, scores each team weekly, and surfaces the results in a glassmorphic dashboard that HR and engineering leads can actually act on.

No surveys. No interruptions. No obvious surveillance. Just signal from the data your team already generates.

</div>

---

## The problem it solves

Burnout doesn't announce itself. It accumulates quietly in after-hours messages, delayed replies, and a slow drift in how people talk. By the time someone quits, six weeks of signal were already there — you just weren't looking at it.

PulseDesk looks at it. It ingests message metadata from Slack (never content), hashes member identities so no PII touches the database, and produces a composite wellbeing score per team. Cross it with four NLP biomarkers and you get something closer to an early-warning system than a retrospective.

---

## Live preview

### Login
<img width="1200" height="720" alt="login" src="https://github.com/user-attachments/assets/245e5bd7-eb82-4227-b04b-7c03da615bd4" />

Glassmorphic auth with gradient orbs behind it, Inter font throughout. Supports login and full org registration — name, org name, org slug. JWT is stored in localStorage, silently refreshed on 401.

---

### Dashboard
<img width="1200" height="720" alt="dashboard" src="https://github.com/user-attachments/assets/a48ed96a-0a3a-4ee0-a46f-2d4d1b94f1ca" />

Four stat cards animate in staggered. Live composite score, at-risk team count, unresolved alerts. Below that: a 14-day area chart (Recharts) with composite, sentiment, after-hours, and latency lines. Right panel: heatmap cards per team, each color-coded to their risk level. Active alerts surface at the bottom with one-click resolve.

---

### Team Burnout Heatmap
<img width="1200" height="720" alt="heatmap" src="https://github.com/user-attachments/assets/83d37057-c11a-4e4e-acf6-833033fd6c5f" />

Every team gets a card. Cards are color-tinted by risk: green for healthy, yellow for moderate, orange for elevated, red for high. A left-border bar pulses on high-risk teams. Composite score, individual biomarker sub-scores (Sentiment, After-Hours, Vocab Shift), and a risk badge. Click any card and a detail panel slides in from the right with a full breakdown and the NLP-generated narrative.

---

### Wellbeing Trends
<img width="1200" height="720" alt="trends" src="https://github.com/user-attachments/assets/70632d78-ec14-4036-8379-fd62370e4cb1" />

Team filter pills at the top. Select one and the area chart transitions to show 16-day rolling data for that team. Composite score as the primary area, with sentiment, after-hours activity, and response latency overlaid as lines. Right panel renders the AI-generated report: risk level, consecutive weeks triggered, and a narrative paragraph produced by the NLP service from actual score data — not a template.

---

### Alerts
<img width="1200" height="720" alt="alerts" src="https://github.com/user-attachments/assets/8a0ea2a3-3627-41cb-9871-27dc39e0fa9b" />

Every alert slides in with a left severity bar (red for critical, orange for warning) and a resolve button. Toggle to show all alerts or unresolved only. Resolving removes the card with an exit animation. When the queue is empty, a green check appears. Alerts are raised by the scoring worker when a team's composite score exceeds a threshold, or when it stays elevated for three consecutive scoring cycles — that's the "sustained burnout" case.

---

### Teams
<img width="1200" height="720" alt="teams" src="https://github.com/user-attachments/assets/218fe7d4-5ee2-4f8f-949f-3d6bc4ff8aa9" />

List of all configured teams with their current score and risk level. "Add Team" expands an inline form — name, Slack channel ID, channel name. "Score Now" triggers an immediate scoring job via the API (`POST /api/teams/:id/score-now`), jumping the queue instead of waiting for the weekly scheduler.

---

### Integrations
<img width="1200" height="720" alt="integrations" src="https://github.com/user-attachments/assets/549a8efe-a8ac-40f9-b69b-1ed26c3fe22b" />

Slack OAuth 2.0 flow, fully automated. Click connect, authorize in Slack, tokens stored. The page renders the current connection status, last sync time, and the live event types being ingested. A privacy section explains exactly what is and isn't stored — because trust matters when you're monitoring people.

---

### System Architecture
<img width="1400" height="820" alt="architecture" src="https://github.com/user-attachments/assets/e62f1824-5c27-4e2b-ab51-917c7c01c46b" />

---

## How it actually works

### Data flow

```
Slack Workspace
      │
      │  message_created / reaction_added / member_joined
      ▼
Slack Webhook  ──► Express /api/slack  ──► BullMQ ingestion queue
                                                  │
                                         ingestion worker (×5 concurrent)
                                                  │
                                         biomarker_events table (PostgreSQL)
                                         member_hash (SHA-256, one-way)
                                                  │
                                   [weekly cron OR manual /score-now]
                                                  │
                                         BullMQ scoring queue
                                                  │
                                         scoring worker (×3 concurrent)
                                                  │
                              ┌───────────────────┴────────────────────┐
                              │          FastAPI NLP Service            │
                              │  POST /sentiment   POST /vocab-shift    │
                              │  POST /score       POST /report         │
                              └───────────────────┬────────────────────┘
                                                  │
                                    composite score written to DB
                                                  │
                                    if score > threshold → alert raised
                                    if 3 consecutive → sustained burnout
                                                  │
                                         BullMQ report queue
                                                  │
                                    report worker → NLP narrative generated
                                                  │
                                        React dashboard (polling / fetch)
```

### NLP biomarkers

| Biomarker | What it measures | Score direction |
|---|---|---|
| **Sentiment** | Tone of messages — positive/negative/neutral signal from vocabulary | Higher = more negative |
| **After-Hours Activity** | Messages sent outside 09:00–18:00 in the team's timezone | Higher = more off-hours |
| **Response Latency** | Time between a message and its first reply | Higher = slower replies |
| **Vocabulary Shift** | Frequency of stress-related words vs baseline week | Higher = more stress vocab |

The composite score is a weighted average of the four. Risk levels: `low` (0–29), `moderate` (30–49), `elevated` (50–69), `high` (70+). An alert fires at elevated. Sustained burnout fires after three consecutive elevated-or-high scoring cycles.

The NLP service is Python / FastAPI. It queries the `biomarker_events` table via `asyncpg`, computes scores in-process using `statistics` and domain-specific word lists, and returns both a numeric score and a prose narrative. No ML model at this stage — the signal comes from behavioural patterns, which turn out to be plenty accurate enough.

### Privacy model

- Message content is **never stored** or sent anywhere.
- Member identities are **SHA-256 hashed** before hitting the database. The hash is one-way. The backend cannot reverse it.
- All data is org-scoped. There is no cross-tenant access, no shared tables, no aggregated view across organisations.
- Slack OAuth scopes are minimised to what's strictly needed: `channels:history` metadata, `users:read` for hashing.

---

## Project structure

```
PulseDesk/
│
├── frontend/                         # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── api.ts                    # All API calls — typed, JWT-aware, auto-redirect on 401
│   │   ├── context/
│   │   │   └── ThemeContext.tsx      # Light/dark toggle, persisted to localStorage
│   │   ├── components/
│   │   │   ├── Layout.tsx            # Sidebar + topbar shell, mobile overlay
│   │   │   ├── GlassCard.tsx         # Reusable glassmorphic card
│   │   │   ├── HeatmapGrid.tsx       # Risk-coloured team cards with biomarker scores
│   │   │   ├── TrendChart.tsx        # Recharts area/line chart, custom tooltip
│   │   │   └── ThemeToggle.tsx       # Sun/moon icon toggle
│   │   └── pages/
│   │       ├── Login.tsx             # Auth + registration form with animated orbs
│   │       ├── Dashboard.tsx         # Stats, trend chart, heatmap, alerts
│   │       ├── Heatmap.tsx           # Full heatmap grid + drill-down panel
│   │       ├── Trends.tsx            # Team filter + area chart + AI report panel
│   │       ├── Teams.tsx             # Team list, create form, score-now trigger
│   │       ├── Alerts.tsx            # Alert list, resolve, toggle unresolved
│   │       └── Integrations.tsx      # Slack OAuth, connection status, privacy info
│   ├── index.css                     # CSS variables, glass utilities, orb animations
│   ├── tailwind.config.js            # Brand palette, risk colours, animation keyframes
│   └── vite.config.ts               # Proxy /api → backend, Docker-aware target
│
├── backend/                          # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── app.ts                    # Express setup: Helmet, CORS, rate-limiting, routes
│   │   ├── server.ts                 # Port binding, BullMQ worker startup, SIGTERM handling
│   │   ├── api/routes.ts             # Route registry: auth, teams, dashboard, alerts...
│   │   ├── db/
│   │   │   ├── connection.ts         # Knex instance
│   │   │   └── migrate.ts            # Schema migrations (run via Docker compose)
│   │   ├── jobs/
│   │   │   └── workers.ts            # BullMQ: ingestion × 5, scoring × 3, report × 2
│   │   └── services/
│   │       ├── biomarkerScoring.ts   # scoreTeam(), generatePulseReport()
│   │       └── logger.ts             # Pino logger, pretty in dev, JSON in prod
│   ├── scripts/
│   │   └── seed.ts                   # Seeds demo org, users, teams, sample events
│   └── Dockerfile                    # Multi-stage: builder → runner, tini entrypoint
│
├── ml/
│   └── inference/
│       ├── nlp_service.py            # FastAPI app — sentiment, vocab-shift, scoring, reports
│       ├── requirements.txt          # fastapi, uvicorn, asyncpg, pydantic
│       └── Dockerfile                # python:3.12-slim, non-root user, 2 uvicorn workers
│
└── docker-compose.yml                # postgres, redis, nlp, backend, migrate, seed, frontend
```

---

## Tech stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | React | 18.3 | Component tree, routing, state |
| Language | TypeScript | 5.6 | End-to-end type safety |
| Build | Vite | 6.0 | Sub-second HMR, code-split output |
| Styling | Tailwind CSS | 3.4 | Utility classes, custom brand palette |
| Animation | Framer Motion | 11.11 | Page transitions, card reveals, stagger |
| Charts | Recharts | 2.13 | Area/line charts, custom tooltip |
| Toast | react-hot-toast | 2.4 | Glassmorphic success/error notifications |
| Fonts | Inter + JetBrains Mono | — | Via @fontsource, self-hosted |
| Backend | Node.js + Express | 4.21 | REST API, Slack webhook receiver |
| Auth | JWT + bcryptjs | — | Access tokens, password hashing |
| Security | Helmet + express-rate-limit | 8.0 / 7.4 | Headers, 10 auth/min, 200 global/min |
| ORM | Knex | 3.1 | Query builder + migrations |
| Database | PostgreSQL | 16 | Persistent data store |
| Queue | Redis + BullMQ | 7 / 5.12 | Job queues for ingestion, scoring, reports |
| Logging | Pino + pino-pretty | 9.5 | Structured JSON logs, coloured dev output |
| Validation | Zod | 3.23 | Runtime schema validation on all inputs |
| NLP Service | FastAPI | 0.115 | Sentiment analysis, vocab shift, narrative gen |
| Async DB | asyncpg | 0.30 | High-performance PostgreSQL driver for Python |
| ASGI Server | Uvicorn | 0.32 | 2 workers, production-ready |
| Infra | Docker + Compose | — | 7-service orchestration, health checks |

---

## Colour system

Pulled directly from `index.css` and `tailwind.config.js`:

```css
/* Light mode */
--bg-primary:   #f8f9fc;
--bg-secondary: #ffffff;
--text-primary: #1a1b2e;
--gradient-1:   linear-gradient(135deg, #4c6ef5 0%, #7c3aed 50%, #a855f7 100%);

/* Dark mode */
--bg-primary:   #0a0b1a;
--bg-secondary: #111328;
--bg-tertiary:  #1a1d35;
--text-primary: #e8e9f0;
--glass-bg:     rgba(17, 19, 40, 0.72);
```

```js
// tailwind.config.js brand palette
brand: {
  500: '#5c7cfa',   // primary interactive
  600: '#4c6ef5',   // buttons, active nav
  700: '#4263eb',
  800: '#3b5bdb',
}

risk: {
  low:      '#22c55e',   // healthy
  moderate: '#eab308',   // watch this
  elevated: '#f97316',   // act soon
  high:     '#ef4444',   // act now
}
```

---

## Getting started

### Prerequisites

- **Node.js 22** (backend), **Node.js 18+** (frontend)
- **Python 3.12**
- **Docker + Docker Compose**
- A **Slack App** with `channels:history`, `users:read`, and webhook event subscriptions configured

### One-command start (Docker)

```bash
git clone https://github.com/sat1828/PulseDesk.git
cd PulseDesk

# Create your env file
cp .env.example .env
# Fill in SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET

# Start everything: postgres + redis + nlp + backend + frontend
docker compose up

# Seed demo data (separate terminal or add --profile seed)
docker compose --profile seed up seed
```

Services come up at:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| NLP Service | http://localhost:5001 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Local development (without Docker)

```bash
# 1 — PostgreSQL and Redis (still needs Docker or a local install)
docker compose up postgres redis -d

# 2 — NLP service
cd ml/inference
pip install -r requirements.txt
DATABASE_URL=postgresql://pulsedesk:pulsedesk_secret@localhost:5432/pulsedesk \
NLP_SERVICE_API_KEY=internal_service_key \
uvicorn nlp_service:app --port 5001 --reload

# 3 — Backend
cd backend
cp .env.example .env   # edit values
npm install
npm run migrate
npm run dev            # tsx watch, port 3001

# 4 — Frontend
cd frontend
npm install
npm run dev            # Vite, port 5173
```

### Seed demo data

```bash
cd backend
npm run seed
# Creates: demo org, admin user, 6 teams, 4 weeks of biomarker events
# Login: admin@demo.com / password123
```

---

## Environment variables

### Backend `.env`

```env
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://pulsedesk:pulsedesk_secret@localhost:5432/pulsedesk
REDIS_URL=redis://localhost:6379

JWT_SECRET=change_this_in_production_use_a_long_random_string

SLACK_CLIENT_ID=your_slack_app_client_id
SLACK_CLIENT_SECRET=your_slack_app_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret

API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173

NLP_SERVICE_URL=http://localhost:5001
NLP_SERVICE_API_KEY=internal_service_key

LOG_LEVEL=info
```

### Frontend

Vite proxies `/api` to the backend — no `.env` needed in development. For production builds:

```env
VITE_API_URL=https://your-api-domain.com
```

---

## API surface

```
POST   /api/auth/register         Create org + admin user
POST   /api/auth/login            Returns JWT
GET    /api/auth/me               Current user

GET    /api/teams                 All teams for org
POST   /api/teams                 Create team
GET    /api/teams/:id             Team detail
POST   /api/teams/:id/score-now  Trigger immediate scoring job
GET    /api/teams/:id/scores      Historical score records
GET    /api/teams/:id/report      Latest NLP narrative report

GET    /api/dashboard/summary     Counts: teams, scores, alerts
GET    /api/dashboard/heatmap     All teams with current risk level
GET    /api/dashboard/trends      Scoring trends (all or per team)

GET    /api/alerts                All alerts (filterable: teamId, unresolved)
PATCH  /api/alerts/:id/resolve    Mark alert resolved

GET    /api/integrations          Connected integrations
DELETE /api/integrations/:id      Disconnect

GET    /api/reports               NLP reports (filterable by team)
GET    /api/reports/latest        One report per team, most recent

POST   /api/slack/events          Slack event webhook receiver
GET    /api/slack/oauth/redirect  OAuth initiation
GET    /api/slack/oauth/callback  OAuth token exchange

GET    /api/config                Public config (Slack client ID for OAuth)
```

---

## Database schema

Seven tables, managed by `tsx src/db/migrate.ts`:

| Table | Purpose |
|---|---|
| `organisations` | Org identity, Slack connection status, settings JSON |
| `users` | Org members with hashed passwords, roles |
| `teams` | Team config with optional Slack channel binding |
| `integrations` | OAuth tokens, workspace info, last sync time |
| `biomarker_events` | Raw ingested events — hashed member ID, timestamp, type, metadata |
| `team_scores` | Weekly composite scores with individual biomarker breakdowns |
| `alerts` | Risk alerts with severity, type, resolution status |

All primary keys are UUIDs (`gen_random_uuid()` via `pgcrypto`). Cascade deletes on org removal.

---

## BullMQ job queues

Three queues, started in `server.ts` via `startWorkers()`:

**`ingestion`** (concurrency 5)
Receives Slack events from the webhook handler. Dispatches to `handleSlackMessage`, `handleSlackReaction`, or `handleCalendarEvent`. Writes hashed biomarker events to PostgreSQL.

**`scoring`** (concurrency 3)
Triggered weekly (cron) or via `/score-now`. Calls `scoreTeam()` from `biomarkerScoring.ts`, which requests sentiment and vocab-shift scores from the NLP service, combines them into a composite, writes to `team_scores`, and raises alerts if thresholds are crossed. If a team scores elevated or high, a report job is enqueued.

**`report`** (concurrency 2)
Calls `generatePulseReport()` which requests a narrative from the NLP service based on the score data. Stores the prose report in the database for the Trends page to surface.

---

## NLP service endpoints

```
GET  /health              Service health + DB connectivity check
POST /sentiment           Compute sentiment score from biomarker events
POST /vocab-shift         Detect vocabulary drift vs baseline window
POST /score               Composite scoring (calls sentiment + vocab internally)
POST /report              Generate prose narrative from score + raw stats
```

All endpoints require `X-API-Key: internal_service_key`. The backend sets this on every request. The key is configurable via `NLP_SERVICE_API_KEY`.

---

## Docker services

```yaml
postgres:   postgres:16-alpine     # persistent via pgdata volume
redis:      redis:7-alpine         # ephemeral, BullMQ job storage
nlp:        python:3.12-slim       # FastAPI NLP, port 5001
backend:    node:22-alpine         # Express API, port 3001, tini PID 1
migrate:    (backend image)        # runs tsx src/db/migrate.ts once and exits
seed:       (backend image)        # profile:seed, runs tsx scripts/seed.ts
frontend:   node:22-alpine         # Vite dev server, port 5173
```

Health checks on postgres and redis. Backend waits for both to be healthy before starting. NLP service waits for postgres. Frontend waits for backend. Migration runs before anything touches the schema.

```bash
docker compose up                   # full stack
docker compose up postgres redis    # just the data layer
docker compose --profile seed up    # include seeder
docker compose down -v              # tear everything down, remove volumes
```

---

## Production checklist

- [ ] Set a real `JWT_SECRET` — minimum 64 random characters
- [ ] Replace `NLP_SERVICE_API_KEY` with a proper secret
- [ ] Add TLS termination in front of the backend (nginx / caddy)
- [ ] Set `FRONTEND_URL` in backend env to your actual domain
- [ ] Configure Slack App with your production redirect URI
- [ ] Set `NODE_ENV=production` — disables pino-pretty, enables JSON logs
- [ ] Set `LOG_LEVEL=warn` to reduce log volume
- [ ] Add a postgres volume backup strategy
- [ ] Consider Redis persistence (`appendonly yes`) if you want queue durability across restarts

---

## What's next

- [ ] Weekly email digest — score summary per team lead
- [ ] MS Teams integration alongside Slack
- [ ] Configurable alert thresholds per org
- [ ] Role-based access — view-only vs full admin
- [ ] Public API for embedding scores in other tools
- [ ] CI/CD with GitHub Actions — lint, typecheck, test, build, push image
- [ ] Auto-migration on container start (instead of separate migrate service)

---

## Author

Built by **[@sat1828](https://github.com/sat1828)**

<div align="center">
<br/>

If this helped you — drop a ⭐

</div>
