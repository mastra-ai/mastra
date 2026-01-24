# Mastra Admin Demo

This example demonstrates the complete Mastra Admin MVP infrastructure for managing teams, projects, and deployments.

## What is Mastra Admin?

Mastra Admin is an enterprise-grade, self-hosted platform that enables organizations to run and operate multiple Mastra servers across their teams. It provides:

- **Team Management**: Create teams, invite members, manage roles
- **Project Management**: Register Mastra projects, configure environment variables
- **Deployment Management**: Create production, staging, and preview deployments
- **Local Project Discovery**: Automatically discover Mastra projects in configured directories
- **Local Process Runner**: Build and run Mastra servers locally
- **Local Edge Router**: Expose deployed servers via port mapping or reverse proxy
- **File-based Observability**: Store logs and metrics locally
- **RBAC**: Role-based access control for team resources
- **License Validation**: Enterprise feature gating

## MVP Infrastructure

The following packages are integrated in this demo:

| Package | Description |
|---------|-------------|
| `@mastra/admin` | Core MastraAdmin class, types, interfaces |
| `@mastra/admin-server` | HTTP API server (Hono-based) |
| `@mastra/admin-pg` | PostgreSQL storage implementation |
| `@mastra/source-local` | Local filesystem project discovery |
| `@mastra/runner-local` | Local process runner (build & run servers) |
| `@mastra/router-local` | Local edge router (expose servers) |
| `@mastra/observability-file-local` | Local file storage for observability |

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- pnpm

## Quick Start

### 1. Start PostgreSQL

```bash
pnpm db:up
```

This starts a PostgreSQL container on port 5432.

### 2. Install Dependencies

From the monorepo root:
```bash
pnpm install
pnpm build
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env to set your PROJECTS_DIR
```

### 4. Run the Demo

```bash
# Basic demo
pnpm dev

# Team management demo
pnpm demo:teams

# Project management demo
pnpm demo:projects

# Full demo with HTTP API
pnpm demo:full
```

## Demo Scripts

### `pnpm dev` (src/index.ts)

Basic demo showing:
- MastraAdmin initialization with full infrastructure
- Team creation
- Project creation with local source
- Environment variable management
- Deployment creation

### `pnpm demo:teams` (src/demo-teams.ts)

Team management focused demo:
- Creating multiple teams
- Listing team members
- Inviting team members

### `pnpm demo:projects` (src/demo-projects.ts)

Project management focused demo:
- Discovering local Mastra projects
- Creating projects from discovered sources
- Setting environment variables
- Creating multiple deployment types

### `pnpm demo:deploy` (src/demo-deploy.ts)

Full deployment lifecycle demo:
- Discovers a local Mastra project
- Creates team, project, and deployment
- Triggers a deployment build
- Streams build logs in real-time
- Shows deployment results with server URL

### `pnpm demo:full` (src/demo-full.ts)

Comprehensive demo with HTTP API:
- All of the above features
- AdminServer HTTP API
- License feature checks
- Infrastructure summary
- Example curl commands

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          MastraAdmin                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐ │
│   │  AdminServer    │     │   MastraAdmin   │     │   Storage     │ │
│   │  (HTTP API)     │────▶│   (Core Logic)  │────▶│  (PostgreSQL) │ │
│   └─────────────────┘     └─────────────────┘     └───────────────┘ │
│                                  │                                   │
│                    ┌─────────────┼─────────────┐                     │
│                    │             │             │                     │
│                    ▼             ▼             ▼                     │
│            ┌───────────┐ ┌───────────┐ ┌───────────┐                │
│            │  Source   │ │  Runner   │ │  Router   │                │
│            │  (Local)  │ │  (Local)  │ │  (Local)  │                │
│            └───────────┘ └───────────┘ └───────────┘                │
│                                  │                                   │
│                                  ▼                                   │
│                          ┌───────────────┐                          │
│                          │ File Storage  │                          │
│                          │ (Observability)│                          │
│                          └───────────────┘                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Configuration

### Runner (LocalProcessRunner)

| Option | Default | Description |
|--------|---------|-------------|
| `portRange` | `{ start: 4111, end: 4200 }` | Port range for server allocation |
| `maxConcurrentBuilds` | `3` | Maximum concurrent builds |
| `defaultBuildTimeoutMs` | `600000` | Build timeout (10 minutes) |
| `logRetentionLines` | `10000` | Log lines per server |
| `buildDir` | `.mastra/builds` | Build artifacts directory |

### Router (LocalEdgeRouter)

| Option | Default | Description |
|--------|---------|-------------|
| `strategy` | `port-mapping` | Routing strategy (`port-mapping` or `reverse-proxy`) |
| `baseDomain` | `localhost` | Base domain for routes |
| `portRange` | `{ start: 3100, end: 3199 }` | Port range for routing |
| `enableTls` | `false` | Enable HTTPS with self-signed certs |
| `enableHostsFile` | `false` | Manage /etc/hosts for custom domains |

### File Storage (LocalFileStorage)

| Option | Default | Description |
|--------|---------|-------------|
| `baseDir` | Required | Base directory for file storage |
| `atomicWrites` | `true` | Use atomic writes for safety |

## API Endpoints

When running `pnpm demo:full`, the AdminServer exposes these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/teams` | List teams |
| POST | `/api/teams` | Create team |
| GET | `/api/teams/:id` | Get team |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| GET | `/api/deployments` | List deployments |
| POST | `/api/deployments` | Create deployment |
| POST | `/api/deployments/:id/deploy` | Trigger deployment |

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/mastra_admin` |
| `PROJECTS_DIR` | Directory to scan for Mastra projects | `../` (parent directory) |
| `PORT` | HTTP server port | `3001` |
| `ADMIN_ENCRYPTION_SECRET` | Secret for encrypting environment variables | Auto-generated (dev only) |

## Deploying a Project

With the complete MVP infrastructure, you can now deploy projects:

```typescript
// Trigger a deployment
const build = await admin.deploy(userId, deploymentId);

// The runner will:
// 1. Clone/copy project source
// 2. Install dependencies
// 3. Build the project
// 4. Start the Mastra server

// The router will:
// 1. Allocate a port
// 2. Create a route mapping
// 3. Expose the server
```

## Future Enhancements

The following features are planned:

- **@mastra/observability-writer**: Batch events to JSONL files
- **@mastra/observability-clickhouse**: ClickHouse ingestion + queries
- **@mastra/source-github**: GitHub integration for private repositories
- **@mastra/runner-k8s**: Kubernetes runner for production
- **@mastra/router-cloudflare**: Cloudflare routing

## Database Commands

```bash
# Start database
pnpm db:up

# Stop database
pnpm db:down

# Reset database (delete all data)
pnpm db:reset
```

## Cleanup

```bash
# Stop database and remove volume
docker compose down -v
```
