# Mastra Admin Example

This example demonstrates the full MastraAdmin platform with:

- PostgreSQL storage for teams, projects, and deployments
- Local project discovery and deployment
- **Admin UI dashboard** for managing everything visually
- Development authentication (no Supabase required)

## Quick Start (Full UI Experience)

### 1. Start PostgreSQL

```bash
pnpm db:up
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and set PROJECTS_DIR to your projects directory
```

### 3. Build the Monorepo

From the monorepo root:

```bash
pnpm install
pnpm build
```

### 4. Run the Full Stack

```bash
cd examples/admin
pnpm dev:full
```

This starts:

- **API Server** on http://localhost:3001
- **Admin UI** on http://localhost:5173

Open http://localhost:5173 in your browser to access the Admin UI.

## Available Scripts

| Script               | Description                                         |
| -------------------- | --------------------------------------------------- |
| `pnpm dev:full`      | **Recommended**: Start both API server and Admin UI |
| `pnpm dev:server`    | Start only the API server                           |
| `pnpm dev:ui`        | Start only the Admin UI                             |
| `pnpm dev`           | Run the basic CLI demo (no UI)                      |
| `pnpm demo:full`     | Run comprehensive CLI demo with all features        |
| `pnpm demo:teams`    | Demo team management                                |
| `pnpm demo:projects` | Demo project management                             |
| `pnpm demo:deploy`   | Demo deployment workflow                            |
| `pnpm db:up`         | Start PostgreSQL container                          |
| `pnpm db:down`       | Stop PostgreSQL container                           |
| `pnpm db:reset`      | Reset database (delete all data)                    |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Admin UI                                │
│                    (http://localhost:5173)                      │
│    React + TanStack Query + Tailwind + shadcn/ui               │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Admin Server                              │
│                    (http://localhost:3001)                      │
│                  Hono HTTP API + WebSockets                     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MastraAdmin                               │
│                   Core Orchestrator                             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Storage   │  │   Source    │  │   Runner    │             │
│  │  (Postgres) │  │   (Local)   │  │   (Local)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Router    │  │ FileStorage │  │    Auth     │             │
│  │   (Local)   │  │   (Local)   │  │    (Dev)    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PostgreSQL                               │
│                    (localhost:5433)                             │
│     Teams, Projects, Deployments, Builds, Env Vars, etc.       │
└─────────────────────────────────────────────────────────────────┘
```

## Development Authentication

For local development, the example uses a mock authentication system:

- **User ID**: `00000000-0000-0000-0000-000000000001`
- **Email**: `demo@example.com`
- **Token**: `dev-token` (any token is accepted)

The Admin UI automatically uses this mock authentication when `VITE_DEV_MODE=true`.

For production, configure Supabase authentication:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEV_MODE=false
```

## Features

### Team Management

- Create and manage teams
- Invite team members
- Role-based access control (Owner, Admin, Developer, Viewer)

### Project Management

- Discover local Mastra projects
- Create projects from discovered sources
- Manage environment variables (with encryption)
- Configure project settings

### Deployment Management

- Create deployments (production, staging, preview)
- Trigger builds
- View build logs in real-time
- Monitor running servers

### Observability

- View traces and spans
- Search logs
- Monitor metrics
- Track evaluations

## Packages Used

| Package                            | Description             |
| ---------------------------------- | ----------------------- |
| `@mastra/admin`                    | Core orchestrator       |
| `@mastra/admin-server`             | HTTP API server         |
| `@mastra/admin-pg`                 | PostgreSQL storage      |
| `@mastra/admin-ui`                 | React dashboard         |
| `@mastra/source-local`             | Local project discovery |
| `@mastra/runner-local`             | Local process runner    |
| `@mastra/router-local`             | Local HTTP router       |
| `@mastra/observability-file-local` | Local file storage      |

## Configuration

| Environment Variable      | Description                                 | Default                                                      |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`            | PostgreSQL connection string                | `postgresql://postgres:postgres@localhost:5433/mastra_admin` |
| `PROJECTS_DIR`            | Directory to scan for Mastra projects       | `../` (parent directory)                                     |
| `PORT`                    | HTTP server port                            | `3001`                                                       |
| `ADMIN_ENCRYPTION_SECRET` | Secret for encrypting environment variables | Auto-generated (dev only)                                    |

## Component Configuration

### Runner (LocalProcessRunner)

| Option                  | Default                      | Description                      |
| ----------------------- | ---------------------------- | -------------------------------- |
| `portRange`             | `{ start: 4111, end: 4200 }` | Port range for server allocation |
| `maxConcurrentBuilds`   | `3`                          | Maximum concurrent builds        |
| `defaultBuildTimeoutMs` | `600000`                     | Build timeout (10 minutes)       |
| `logRetentionLines`     | `10000`                      | Log lines per server             |
| `buildDir`              | `.mastra/builds`             | Build artifacts directory        |

### Router (LocalEdgeRouter)

| Option            | Default                      | Description                                          |
| ----------------- | ---------------------------- | ---------------------------------------------------- |
| `strategy`        | `port-mapping`               | Routing strategy (`port-mapping` or `reverse-proxy`) |
| `baseDomain`      | `localhost`                  | Base domain for routes                               |
| `portRange`       | `{ start: 3100, end: 3199 }` | Port range for routing                               |
| `enableTls`       | `false`                      | Enable HTTPS with self-signed certs                  |
| `enableHostsFile` | `false`                      | Manage /etc/hosts for custom domains                 |

### File Storage (LocalFileStorage)

| Option         | Default  | Description                     |
| -------------- | -------- | ------------------------------- |
| `baseDir`      | Required | Base directory for file storage |
| `atomicWrites` | `true`   | Use atomic writes for safety    |

## API Endpoints

When running the server, these endpoints are available:

| Method | Endpoint                        | Description        |
| ------ | ------------------------------- | ------------------ |
| GET    | `/api/health`                   | Health check       |
| GET    | `/api/teams`                    | List teams         |
| POST   | `/api/teams`                    | Create team        |
| GET    | `/api/teams/:id`                | Get team           |
| GET    | `/api/teams/:id/projects`       | List team projects |
| POST   | `/api/teams/:id/projects`       | Create project     |
| GET    | `/api/projects/:id`             | Get project        |
| GET    | `/api/projects/:id/deployments` | List deployments   |
| POST   | `/api/projects/:id/deployments` | Create deployment  |
| POST   | `/api/deployments/:id/deploy`   | Trigger deployment |
| GET    | `/api/deployments/:id/builds`   | List builds        |
| GET    | `/api/builds/:id/logs`          | Get build logs     |

## CLI Demo Scripts

For CLI-based exploration without the UI:

### `pnpm dev` (src/index.ts)

Basic demo showing MastraAdmin initialization, team creation, project creation, and deployment setup.

### `pnpm demo:full` (src/demo-full.ts)

Comprehensive demo with AdminServer HTTP API, example curl commands, and infrastructure summary.

### `pnpm demo:deploy` (src/demo-deploy.ts)

Full deployment lifecycle demo including build and server startup.

## Troubleshooting

### Database connection failed

Make sure PostgreSQL is running:

```bash
pnpm db:up
docker ps  # Should show mastra-admin-demo-db
```

### Port already in use

The default ports are:

- 5433: PostgreSQL
- 3001: API Server
- 5173: Admin UI (Vite dev server)

Change the port in `.env` if needed.

### Projects not discovered

Update `PROJECTS_DIR` in `.env` to point to a directory containing Mastra projects.
Projects must have a valid `mastra.config.ts` or `mastra.config.js` file.

### Build failures

Make sure you've built the monorepo first:

```bash
cd ../..  # Go to monorepo root
pnpm build
```

### UI shows "Not authenticated"

Ensure the server is running (`pnpm dev:server`) and the UI is using dev mode.
The `pnpm dev:full` command handles this automatically.

## Cleanup

```bash
# Stop database and remove volume
pnpm db:down -v
```
