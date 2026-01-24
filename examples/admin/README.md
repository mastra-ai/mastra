# Mastra Admin Demo

This example demonstrates the Mastra Admin platform functionality for managing teams, projects, and deployments.

## What is Mastra Admin?

Mastra Admin is an enterprise-grade, self-hosted platform that enables organizations to run and operate multiple Mastra servers across their teams. It provides:

- **Team Management**: Create teams, invite members, manage roles
- **Project Management**: Register Mastra projects, configure environment variables
- **Deployment Management**: Create production, staging, and preview deployments
- **Local Project Discovery**: Automatically discover Mastra projects in configured directories
- **RBAC**: Role-based access control for team resources
- **License Validation**: Enterprise feature gating

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
- MastraAdmin initialization
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

### `pnpm demo:full` (src/demo-full.ts)

Comprehensive demo with HTTP API:
- All of the above features
- AdminServer HTTP API
- License feature checks
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
│                                  │                                   │
│                           ┌──────┴──────┐                           │
│                           │             │                           │
│                           ▼             ▼                           │
│                   ┌───────────┐   ┌───────────┐                     │
│                   │  Source   │   │   RBAC    │                     │
│                   │  (Local)  │   │  Manager  │                     │
│                   └───────────┘   └───────────┘                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Packages Used

| Package | Description |
|---------|-------------|
| `@mastra/admin` | Core MastraAdmin class, types, interfaces |
| `@mastra/admin-pg` | PostgreSQL storage implementation |
| `@mastra/admin-server` | HTTP API server (Hono-based) |
| `@mastra/source-local` | Local filesystem project discovery |

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

## Future Features

The following features are planned but not yet implemented:

- **@mastra/runner-local**: Local process runner for building and running Mastra servers
- **@mastra/router-local**: Local reverse proxy for exposing deployed servers
- **@mastra/source-github**: GitHub integration for private repository cloning

Once these packages are available, you'll be able to:
- Actually build and deploy Mastra projects
- Expose deployed servers via HTTP
- Connect GitHub repositories as project sources

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
