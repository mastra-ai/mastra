# MastraAdmin Master Implementation Plan

## Vision & Purpose

### Why MastraAdmin Exists

**MastraAdmin is an enterprise-grade, self-hosted platform that enables organizations to run and operate many Mastra servers across their teams.**

The open-source Mastra framework (`@mastra/core`, etc.) allows anyone to build and run a single Mastra server. But enterprises need more:

| Open Source Mastra | Enterprise MastraAdmin |
|-------------------|------------------------|
| Single Mastra server | Many Mastra servers across teams |
| Self-managed deployment | Managed deployments with build queue |
| No multi-tenancy | Teams, users, RBAC |
| Manual observability setup | Centralized observability across all projects |
| DIY routing/exposure | Edge routing with Cloudflare/local support |
| No preview environments | Branch deployments and PR previews |

### The Enterprise Use Case

Consider a company like Indeed with multiple AI/agent teams:

```
Indeed (Enterprise)
└── MastraAdmin (self-hosted on Indeed's infrastructure)
    │
    ├── Team: Search Ranking
    │   ├── Users: alice@indeed.com, bob@indeed.com
    │   └── Project: job-matching-agent
    │       ├── production (main) → job-matching-agent.indeed.internal
    │       ├── staging → staging--job-matching-agent.indeed.internal
    │       └── preview/pr-456 → pr-456--job-matching-agent.indeed.internal
    │
    ├── Team: Job Posting
    │   ├── Users: carol@indeed.com, dave@indeed.com
    │   └── Project: posting-assistant
    │       ├── production → posting-assistant.indeed.internal
    │       └── preview/feature-x → feature-x--posting-assistant.indeed.internal
    │
    └── Team: Customer Support
        └── Project: support-chatbot
            └── production → support-chatbot.indeed.internal
```

### Key User Personas

1. **Platform Admin** (DevOps/Platform team):
   - Deploys MastraAdmin to company infrastructure
   - Configures auth (connects to company SSO)
   - Sets up runners (local processes, K8s cluster)
   - Configures edge routing (Cloudflare tunnels, internal DNS)
   - Monitors all teams' usage, health, and costs

2. **Team Lead**:
   - Creates team, invites members
   - Sets team-level resource quotas and permissions
   - Manages team's secrets and API tokens
   - Reviews team's observability data

3. **Developer**:
   - Connects their Mastra project (local path or GitHub repo)
   - Configures environment variables per deployment
   - Triggers builds or sets up auto-deploy from git
   - Views logs, traces, and metrics for their agents
   - Creates preview deployments for branches/PRs

### Licensing Model

MastraAdmin is **enterprise and license-gated**. This means:
- License validation is built into the core
- Features may be tiered (e.g., local runner = base, K8s runner = enterprise+)
- Self-hosted deployments require a valid license key

---

## Overview

This master plan establishes swim lanes for parallel implementation of the MastraAdmin platform. Each swim lane represents an independent work stream that can be executed by separate agents, with clear dependencies between lanes.

## Key Decisions

| Decision | Choice |
|----------|--------|
| **Package Architecture** | **Split: `@mastra/admin` (types/interfaces) + `@mastra/admin-server` (services/API)** |
| Auth Provider | Supabase (reuse existing `@mastra/auth-supabase`) |
| Storage | PostgreSQL |
| Observability | **File-based ingestion → ClickHouse** |
| Observability File Storage | **Adapter pattern: Local, S3, GCS** |
| Runner | LocalProcess (MVP), Kubernetes (future) |
| **Edge Router** | **Adapter pattern: Cloudflare (prod), Local (dev)** |
| Billing | NoBilling |
| Email | Console |
| Encryption | NodeCrypto (AES-256-GCM) |
| **Project Source** | **Adapter pattern: Local first, GitHub later** |
| **Licensing** | **Built-in license validation in core** |
| Base Class | Reuse `MastraBase` from `@mastra/core` |
| Storage Pattern | Separate `AdminStorage` (not `MastraCompositeStore`) |
| Auth Pattern | **Reuse existing `@mastra/auth-*` packages directly** |
| **Deployment Model** | **Project → Many Deployments (production, staging, previews)** |
| **API Framework** | **Hono (same as `@mastra/server`)** |

### Package Architecture: Core vs Server

The MastraAdmin platform follows the same pattern as Mastra core + server:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PACKAGE ARCHITECTURE                                    │
│                   (Same pattern as @mastra/core + @mastra/server)                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   @mastra/admin (packages/admin/)              @mastra/admin-server              │
│   ┌──────────────────────────────┐            (packages/admin-server/)           │
│   │  MastraAdmin class           │            ┌──────────────────────────────┐  │
│   │  • Central orchestrator      │            │  HTTP wrapper for MastraAdmin│  │
│   │  • Business logic methods:   │ ◄──────────│                              │  │
│   │    - createTeam()            │  injected  │  • Hono HTTP routes          │  │
│   │    - createProject()         │   into     │  • Auth middleware           │  │
│   │    - deploy()                │  handlers  │  • Request/response mapping  │  │
│   │    - triggerBuild()          │            │  • Build worker process      │  │
│   │  • Provider interfaces       │            │                              │  │
│   │  • RBAC, License, Types      │            │  Handlers call MastraAdmin   │  │
│   │  • BuildOrchestrator         │            │  methods directly            │  │
│   └──────────────────────────────┘            └──────────────────────────────┘  │
│                                                                                  │
│   Like Mastra class - you can                 Like @mastra/server - exposes     │
│   instantiate and call directly               MastraAdmin via HTTP              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**This mirrors the existing Mastra pattern:**

| Mastra Framework | MastraAdmin Platform |
|------------------|---------------------|
| `@mastra/core` → `Mastra` class with methods | `@mastra/admin` → `MastraAdmin` class with methods |
| `@mastra/server` → HTTP wrapper, injects `Mastra` into handlers | `@mastra/admin-server` → HTTP wrapper, injects `MastraAdmin` into handlers |

**Usage:**

```typescript
// Direct usage (like using Mastra class directly)
const admin = new MastraAdmin({ storage, runner, router, ... });
await admin.init();
const team = await admin.createTeam({ name: 'Search Ranking', slug: 'search' });
const project = await admin.createProject(team.id, { name: 'job-matcher', ... });
await admin.deploy(project.id, 'production');

// Via HTTP server (like using @mastra/server)
const server = new AdminServer({ admin, port: 3000 });
await server.start();
// POST /api/teams → calls admin.createTeam()
// POST /api/projects → calls admin.createProject()
// POST /api/deployments/:id/deploy → calls admin.deploy()
```

### Observability File-Based Ingestion Architecture

The observability system uses a **file-based ingestion pattern** for reliability and efficiency:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY DATA FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Mastra Projects          ObservabilityWriter         FileStorageProvider  │
│   ┌──────────────┐         ┌──────────────────┐        ┌─────────────────┐  │
│   │ traces       │         │ - Batches events │        │ Local Filesystem│  │
│   │ spans        │ ──────► │ - Writes JSONL   │ ─────► │ Amazon S3       │  │
│   │ logs         │         │ - Rotates files  │        │ Google GCS      │  │
│   │ metrics      │         └──────────────────┘        └─────────────────┘  │
│   │ scores       │                                              │           │
│   └──────────────┘                                              │           │
│                                                                 ▼           │
│                          ┌──────────────────────────────────────────────┐   │
│                          │            Ingestion Worker                  │   │
│                          │  - Watches for new files                     │   │
│                          │  - Reads JSONL batches                       │   │
│                          │  - Bulk inserts to ClickHouse                │   │
│                          │  - Marks files as processed                  │   │
│                          │  - Runs as background process/cron           │   │
│                          └──────────────────────────────────────────────┘   │
│                                              │                              │
│                                              ▼                              │
│                          ┌──────────────────────────────────────────────┐   │
│                          │              ClickHouse                      │   │
│                          │  - Stores observability data                 │   │
│                          │  - Provides analytics queries                │   │
│                          │  - Materialized views for aggregations       │   │
│                          └──────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- **Decoupled writes** - Application doesn't block on ClickHouse availability
- **Resilience** - Data persisted to durable storage even if ClickHouse is down
- **Bulk efficiency** - ClickHouse performs better with batch inserts vs individual writes
- **Flexibility** - Swap storage backends (local dev → S3 prod) without code changes
- **Scalability** - Workers can scale independently from application

**File Format:** JSONL (JSON Lines) - one event per line, easy to parse and stream

### Project Source Adapter Pattern

The system uses a `ProjectSourceProvider` adapter pattern for accessing project code:

1. **Phase 1 (MVP)**: `LocalProjectSource` - Points to local filesystem paths
2. **Phase 2 (Future)**: `GitHubProjectSource` - Full GitHub App integration with private repo cloning

This allows developers to start testing immediately with local repos while designing for future extensibility.

### Architecture Overview

MastraAdmin is a **control plane** that orchestrates Mastra server deployments. The architecture consists of two main packages plus pluggable providers:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              MastraAdmin Architecture                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────────────┐ │
│   │                    @mastra/admin-server (Control Plane)                        │ │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐  │ │
│   │  │                           HTTP API (Hono)                               │  │ │
│   │  │  POST /teams, GET /projects, POST /deployments/:id/deploy, etc.         │  │ │
│   │  └─────────────────────────────────────────────────────────────────────────┘  │ │
│   │                                     │                                          │ │
│   │                                     ▼                                          │ │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐  │ │
│   │  │ TeamService │ │ProjectService│ │DeployService│ │   BuildOrchestrator    │  │ │
│   │  │ - create    │ │ - create    │ │ - create    │ │   - processQueue()     │  │ │
│   │  │ - invite    │ │ - configure │ │ - trigger   │ │   - build → deploy     │  │ │
│   │  │ - members   │ │ - envVars   │ │ - rollback  │ │   - route → cleanup    │  │ │
│   │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘  │ │
│   │                                     │                                          │ │
│   │                    uses providers from @mastra/admin                           │ │
│   └─────────────────────────────────────┼─────────────────────────────────────────┘ │
│                                         │                                            │
│         ┌───────────────────────────────┼───────────────────────────────┐           │
│         │                               │                               │           │
│         ▼                               ▼                               ▼           │
│   ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐      │
│   │  AdminStorage   │         │  ProjectRunner  │         │ EdgeRouter      │      │
│   │  (admin-pg)     │         │  (runner-local) │         │ (router-local)  │      │
│   └────────┬────────┘         └────────┬────────┘         └────────┬────────┘      │
│            │                           │                           │               │
│            │ persists                  │ builds & runs             │ routes        │
│            ▼                           ▼                           ▼               │
│   ┌─────────────────┐         ┌─────────────────────────────────────────────┐      │
│   │   PostgreSQL    │         │           Running Mastra Servers            │      │
│   │   (teams,       │         │  ┌───────────────────────────────────────┐  │      │
│   │   projects,     │         │  │ job-matching-agent (prod)     :3001   │◄─┼──────┤
│   │   deployments,  │         │  │ job-matching-agent (staging)  :3002   │  │      │
│   │   builds)       │         │  │ job-matching-agent (pr-456)   :3003   │  │ ext  │
│   └─────────────────┘         │  │ posting-assistant (prod)      :3004   │  │ traffic
│                               │  └───────────────────────────────────────┘  │      │
│                               └──────────────────┬──────────────────────────┘      │
│                                                  │ sends traces/logs/metrics       │
│                                                  ▼                                 │
│                               ┌────────────────────────────────────────────────┐   │
│                               │  File Storage → Ingestion Worker → ClickHouse │   │
│                               └────────────────────────────────────────────────┘   │
│                                                                                     │
│   ┌───────────────────────────────────────────────────────────────────────────────┐│
│   │                        @mastra/admin-ui (Dashboard)                           ││
│   │   React/Next.js app that calls admin-server HTTP API                          ││
│   └───────────────────────────────────────────────────────────────────────────────┘│
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Components:**

1. **@mastra/admin** - Types, interfaces, license validation, RBAC (no business logic)
2. **@mastra/admin-server** - Services, API, build orchestration (actual operations)
3. **@mastra/admin-pg** - PostgreSQL storage implementation
4. **@mastra/runner-local** - Local process runner (builds and runs servers)
5. **@mastra/router-local** - Local edge router (exposes services)
6. **@mastra/admin-ui** - Admin dashboard UI

### Data Model

The core entities and their relationships:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA MODEL                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Team (1)─────────────────┬──────────────────────────────────────────────── │
│   │                       │                                                  │
│   │ has many              │ has many                                         │
│   ▼                       ▼                                                  │
│  TeamMember            Project (1)────────────────────────────────────────── │
│   │                       │                                                  │
│   │                       │ has many                                         │
│   │                       ▼                                                  │
│   │                    Deployment (1)─────────────────────────────────────── │
│   │                       │                                                  │
│   │                       │ has many              has one                    │
│   │                       ▼                       ▼                          │
│   │                     Build ◄────────────► RunningServer                   │
│   │                                                                          │
│   │ User ◄───────────────────────────────────────────────────────────────── │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Entity Definitions:**

```typescript
// Team - organizational unit
interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  settings: TeamSettings;
}

// Project - a Mastra codebase
interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;

  // Source configuration
  sourceType: 'local' | 'github';
  sourceConfig: LocalSourceConfig | GitHubSourceConfig;

  // Default settings inherited by deployments
  defaultBranch: string;           // e.g., "main"
  envVars: EncryptedEnvVar[];      // base env vars

  createdAt: Date;
  updatedAt: Date;
}

// Deployment - a running instance of a project (production, staging, preview)
interface Deployment {
  id: string;
  projectId: string;

  // Deployment identity
  type: 'production' | 'staging' | 'preview';
  branch: string;                  // e.g., "main", "staging", "feature-x"
  slug: string;                    // URL-safe identifier

  // Current state
  status: 'pending' | 'building' | 'running' | 'stopped' | 'failed';
  currentBuildId: string | null;

  // Routing
  publicUrl: string | null;        // e.g., "https://feature-x--job-agent.company.com"
  internalHost: string | null;     // e.g., "localhost:3001"

  // Configuration (overrides project defaults)
  envVarOverrides: EncryptedEnvVar[];

  // Lifecycle
  autoShutdown: boolean;           // For previews: shutdown after inactivity
  expiresAt: Date | null;          // For previews: auto-delete after PR merge

  createdAt: Date;
  updatedAt: Date;
}

// Build - a single build attempt for a deployment
interface Build {
  id: string;
  deploymentId: string;

  // What triggered this build
  trigger: 'manual' | 'webhook' | 'schedule' | 'rollback';
  triggeredBy: string;             // userId or 'system'

  // Git info
  commitSha: string;
  commitMessage: string | null;

  // Build state
  status: 'queued' | 'building' | 'deploying' | 'succeeded' | 'failed' | 'cancelled';

  // Logs and timing
  logs: string;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;

  // Result
  errorMessage: string | null;
}

// RunningServer - runtime state of a deployment
interface RunningServer {
  id: string;
  deploymentId: string;
  buildId: string;

  // Process info
  processId: number | null;        // For local runner
  containerId: string | null;      // For K8s runner

  // Network
  host: string;
  port: number;

  // Health
  healthStatus: 'starting' | 'healthy' | 'unhealthy' | 'stopping';
  lastHealthCheck: Date | null;

  // Resource usage
  memoryUsageMb: number | null;
  cpuPercent: number | null;

  startedAt: Date;
  stoppedAt: Date | null;
}
```

### Build & Deploy Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         BUILD & DEPLOY FLOW                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. TRIGGER                    2. QUEUE                   3. BUILD            │
│  ┌─────────────────┐          ┌─────────────────┐        ┌─────────────────┐ │
│  │ User clicks     │          │ Build record    │        │ Runner picks    │ │
│  │ "Deploy" or     │ ───────► │ created with    │ ─────► │ up build from   │ │
│  │ webhook fires   │          │ status: queued  │        │ queue           │ │
│  └─────────────────┘          └─────────────────┘        └────────┬────────┘ │
│                                                                   │          │
│                                                                   ▼          │
│  6. CLEANUP                    5. ROUTE                  4. START            │
│  ┌─────────────────┐          ┌─────────────────┐        ┌─────────────────┐ │
│  │ Old server      │          │ Edge Router     │        │ Runner starts   │ │
│  │ stopped after   │ ◄─────── │ updated with    │ ◄───── │ server, health  │ │
│  │ health check    │          │ new route       │        │ check passes    │ │
│  └─────────────────┘          └─────────────────┘        └─────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure (Following Existing Patterns)

The structure follows established Mastra conventions where implementations live in top-level directories, not under `packages/`:

```
packages/admin/                    → @mastra/admin (types, interfaces, RBAC, license - NO business logic)
packages/admin-server/             → @mastra/admin-server (services, API, orchestration - ACTUAL operations)
packages/admin-ui/                 → @mastra/admin-ui (dashboard application)

stores/admin-pg/                   → @mastra/admin-pg (PostgreSQL - follows stores/pg pattern)

# Observability: File-based ingestion with storage adapters
observability/writer/              → @mastra/observability-writer (writes to file storage)
observability/file-local/          → @mastra/observability-file-local (local filesystem)
observability/file-s3/             → @mastra/observability-file-s3 (Amazon S3)
observability/file-gcs/            → @mastra/observability-file-gcs (Google Cloud Storage)
observability/clickhouse/          → @mastra/observability-clickhouse (ClickHouse queries + ingestion worker)

runners/local/                     → @mastra/runner-local (LocalProcess runner)
runners/k8s/                       → @mastra/runner-k8s (Kubernetes runner - future)

# Edge Routers: Expose Mastra servers to the internet
routers/local/                     → @mastra/router-local (local reverse proxy for dev)
routers/cloudflare/                → @mastra/router-cloudflare (Cloudflare Tunnels for prod)

sources/local/                     → @mastra/source-local (Local filesystem)
sources/github/                    → @mastra/source-github (GitHub App - future)

# Auth: Reuse existing packages directly
auth/supabase/                     → @mastra/auth-supabase (existing - no changes needed)
```

**Rationale:**
- `stores/` - Matches existing `stores/pg/`, `stores/libsql/` pattern
- `observability/` - New top-level directory for observability system:
  - `writer/` - Core writer that batches and writes to file storage
  - `file-*/` - File storage adapters (local, S3, GCS)
  - `clickhouse/` - ClickHouse schema, queries, and ingestion worker
- `runners/` - New top-level directory for runner implementations (similar to `deployers/`)
- `routers/` - New top-level directory for edge router implementations:
  - `local/` - Local reverse proxy for development (port forwarding, localhost routing)
  - `cloudflare/` - Cloudflare Tunnels integration for production exposure
- `sources/` - New top-level directory for project source implementations
- `auth/` - **Reuse existing auth providers** - no admin-specific packages needed

---

## Swim Lane Dependency Graph

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      LAYER 0 (Foundation)                    │
                    │                                                              │
                    │  ┌────────────────────────────────────────────────────────┐ │
                    │  │               LANE 1: @mastra/admin                    │ │
                    │  │   Types, Interfaces, RBAC, License, Abstract Classes   │ │
                    │  │   (includes ProjectSourceProvider, FileStorageProvider,│ │
                    │  │    EdgeRouterProvider, ObservabilityWriter interfaces) │ │
                    │  │   *** NO BUSINESS LOGIC - just contracts ***           │ │
                    │  └────────────────────────────────────────────────────────┘ │
                    └─────────────────────────────────────────────────────────────┘
                                              │
          ┌───────────────────────────────────┼───────────────────────────────────┐
          │                                   │                                   │
          ▼                                   ▼                                   ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐   ┌─────────────────────────────┐
│     LAYER 1 (Storage)       │   │   LAYER 1 (Observability)   │   │    LAYER 1 (Execution)      │
│                             │   │                             │   │                             │
│ ┌─────────────────────────┐ │   │ ┌─────────────────────────┐ │   │ ┌─────────────────────────┐ │
│ │  LANE 2: admin-pg       │ │   │ │  LANE 3a: obs-writer    │ │   │ │  LANE 4: source-local   │ │
│ │  stores/admin-pg/       │ │   │ │  observability/writer/  │ │   │ │  sources/local/         │ │
│ │  PostgreSQL Storage     │ │   │ │  ObservabilityWriter    │ │   │ │  Local Project Source   │ │
│ │  (incl. deployments,    │ │   │ └─────────────────────────┘ │   │ └─────────────────────────┘ │
│ │   builds tables)        │ │   │              │              │   │              │              │
│ └─────────────────────────┘ │   │              ▼              │   │              ▼              │
│                             │   │ ┌─────────────────────────┐ │   │ ┌─────────────────────────┐ │
│ ┌─────────────────────────┐ │   │ │  LANE 3b: file-local    │ │   │ │  LANE 5: runner-local   │ │
│ │  LANE 6: Simple Provs   │ │   │ │  observability/file-*   │ │   │ │  runners/local/         │ │
│ │  NoBilling, Console,    │ │   │ │  Local/S3/GCS adapters  │ │   │ │  LocalProcess Runner    │ │
│ │  NodeCrypto (in core)   │ │   │ └─────────────────────────┘ │   │ └─────────────────────────┘ │
│ └─────────────────────────┘ │   │              │              │   │              │              │
│                             │   │              ▼              │   │              ▼              │
│                             │   │ ┌─────────────────────────┐ │   │ ┌─────────────────────────┐ │
│                             │   │ │  LANE 3c: clickhouse    │ │   │ │  LANE 12: router-local  │ │
│                             │   │ │  observability/clickhouse│ │   │ │  routers/local/         │ │
│                             │   │ │  Queries + Ingestion    │ │   │ │  Local Edge Router      │ │
│                             │   │ │  Worker (file→CH sync)  │ │   │ └─────────────────────────┘ │
│                             │   │ └─────────────────────────┘ │   │                             │
└─────────────────────────────┘   └─────────────────────────────┘   └─────────────────────────────┘
                    │                         │                              │
                    └─────────────────────────┼──────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                   LAYER 1.5 (Server)                         │
                    │                                                              │
                    │  ┌────────────────────────────────────────────────────────┐ │
                    │  │          LANE 1.5: @mastra/admin-server                │ │
                    │  │          packages/admin-server/                        │ │
                    │  │                                                        │ │
                    │  │  ┌──────────────────────────────────────────────────┐  │ │
                    │  │  │  HTTP wrapper for MastraAdmin (like @mastra/server)│ │ │
                    │  │  │                                                    │ │ │
                    │  │  │  • Routes call admin.createTeam(), admin.deploy()  │ │ │
                    │  │  │  • Auth middleware uses admin.getAuth()            │ │ │
                    │  │  │  • Build worker calls admin.getOrchestrator()      │ │ │
                    │  │  └──────────────────────────────────────────────────┘  │ │
                    │  │                                                        │ │
                    │  │  Business logic is in MastraAdmin (LANE 1), not here   │ │
                    │  └────────────────────────────────────────────────────────┘ │
                    └─────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      LAYER 2 (Integration)                   │
                    │                                                              │
                    │   ┌──────────────────────────────────────────────────────┐  │
                    │   │              LANE 7: Integration Tests               │  │
                    │   │           E2E tests with all providers               │  │
                    │   └──────────────────────────────────────────────────────┘  │
                    └─────────────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                    │
                    ▼                                                    ▼
┌───────────────────────────────────────────────┐   ┌───────────────────────────────────────────────┐
│               LAYER 3 (Deployment)            │   │               LAYER 3 (UI)                    │
│                                               │   │                                               │
│  ┌─────────────────────────────────────────┐ │   │  ┌─────────────────────────────────────────┐ │
│  │   LANE 8: Docker Self-Hosting           │ │   │  │   LANE 9: @mastra/admin-ui              │ │
│  │   Docker Compose, Documentation         │ │   │  │   packages/admin-ui/                    │ │
│  └─────────────────────────────────────────┘ │   │  │   Admin Dashboard UI                    │ │
└───────────────────────────────────────────────┘   │  └─────────────────────────────────────────┘ │
                                                    └───────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      LAYER 4 (Future)                        │
                    │                                                              │
                    │  ┌─────────────────────────────────────────────────────────┐│
                    │  │   LANE 10: @mastra/runner-k8s                          ││
                    │  │   runners/k8s/                                         ││
                    │  │   Kubernetes Runner                                    ││
                    │  └─────────────────────────────────────────────────────────┘│
                    │                                                              │
                    │  ┌─────────────────────────────────────────────────────────┐│
                    │  │   LANE 11: @mastra/source-github                       ││
                    │  │   sources/github/                                      ││
                    │  │   GitHub App Integration (private repos, webhooks)     ││
                    │  └─────────────────────────────────────────────────────────┘│
                    │                                                              │
                    │  ┌─────────────────────────────────────────────────────────┐│
                    │  │   LANE 13: @mastra/router-cloudflare                   ││
                    │  │   routers/cloudflare/                                  ││
                    │  │   Cloudflare Tunnels for production routing            ││
                    │  └─────────────────────────────────────────────────────────┘│
                    └─────────────────────────────────────────────────────────────┘
```

**Note:** Auth is not a swim lane - we reuse existing `@mastra/auth-supabase` directly.

---

## Swim Lane Details

### LANE 1: @mastra/admin (Core Package)

**Plan File**: `2025-01-23-admin-core.md`
**Priority**: P0 (Must be completed first)
**Dependencies**: None (foundation)
**Estimated Complexity**: High

**This package follows the same pattern as `@mastra/core`**: The `MastraAdmin` class is a central orchestrator with business logic methods that you can instantiate and call directly. `@mastra/admin-server` (LANE 1.5) is just an HTTP wrapper.

**Scope**:
1. Package setup (`packages/admin/`)
2. **MastraAdmin class** - Central orchestrator with business logic methods:
   - Team management: `createTeam()`, `getTeam()`, `listTeams()`, `inviteMember()`, etc.
   - Project management: `createProject()`, `getProject()`, `setEnvVar()`, etc.
   - Deployment management: `createDeployment()`, `deploy()`, `stop()`, `rollback()`, etc.
   - Build management: `triggerBuild()`, `getBuild()`, `getBuildLogs()`, etc.
3. **BuildOrchestrator** - Manages build queue and deploy flow (used internally by `deploy()`)
4. Abstract provider interfaces (contracts for pluggable components):
   - `AdminStorage` (abstract, NOT extending MastraCompositeStore)
   - `FileStorageProvider` (abstract interface for file storage - local/S3/GCS)
   - `ObservabilityWriter` (interface for writing observability events)
   - `ObservabilityQueryProvider` (interface for querying observability data)
   - `ProjectRunner` (interface for building and running deployments)
   - `EdgeRouterProvider` (interface for exposing services to the internet)
   - `ProjectSourceProvider` (abstract interface for project source operations)
   - `BillingProvider`
   - `EmailProvider`
   - `EncryptionProvider`
4. Core types and interfaces:
   - User, Team, TeamMember
   - Project, Deployment, Build, RunningServer
   - Environment variables and secrets
5. License validation system:
   - `LicenseValidator` class
   - License key verification
   - Feature gating based on license tier
   - License expiration handling
6. Observability event types (Trace, Span, Log, Metric, Score)
7. RBACManager core implementation
8. Error classes and error handling
9. Built-in simple providers:
   - `NoBillingProvider`
   - `ConsoleEmailProvider`
   - `NodeCryptoEncryptionProvider`

**Auth Note**: MastraAdmin accepts existing `MastraAuthProvider` instances from `@mastra/auth-*` packages. No admin-specific auth abstraction needed.

**Key Files to Create**:
```
packages/admin/
├── src/
│   ├── index.ts
│   ├── mastra-admin.ts
│   ├── types.ts                         # Core entity types (Team, Project, Deployment, Build, etc.)
│   ├── errors.ts
│   ├── license/
│   │   ├── validator.ts                 # LicenseValidator class
│   │   ├── types.ts                     # License tiers, features
│   │   └── features.ts                  # Feature gating logic
│   ├── storage/
│   │   └── base.ts                      # AdminStorage interface
│   ├── file-storage/
│   │   └── base.ts                      # FileStorageProvider interface
│   ├── observability/
│   │   ├── writer.ts                    # ObservabilityWriter interface
│   │   ├── query-provider.ts            # ObservabilityQueryProvider interface
│   │   └── types.ts                     # Trace, Span, Log, Metric, Score types
│   ├── runner/
│   │   └── base.ts                      # ProjectRunner interface
│   ├── router/
│   │   └── base.ts                      # EdgeRouterProvider interface
│   ├── source/
│   │   └── base.ts                      # ProjectSourceProvider interface
│   ├── billing/
│   │   ├── base.ts
│   │   └── no-billing.ts
│   ├── email/
│   │   ├── base.ts
│   │   └── console.ts
│   ├── encryption/
│   │   ├── base.ts
│   │   └── node-crypto.ts
│   ├── rbac/
│   │   ├── manager.ts
│   │   ├── roles.ts
│   │   └── types.ts
├── package.json
└── tsconfig.json
```

**MastraAdmin Class (Central Orchestrator)**:
```typescript
import type { MastraAuthProvider } from '@mastra/core/server';

export interface MastraAdminConfig<
  TStorage extends AdminStorage = AdminStorage,
  TRunner extends ProjectRunner = ProjectRunner,
  TRouter extends EdgeRouterProvider = EdgeRouterProvider,
  TSource extends ProjectSourceProvider = ProjectSourceProvider,
> {
  licenseKey: string;
  auth: MastraAuthProvider;
  storage: TStorage;
  runner?: TRunner;
  router?: TRouter;
  source?: TSource;
  billing?: BillingProvider;
  email?: EmailProvider;
  encryption?: EncryptionProvider;
  observability?: ObservabilityConfig;
  logger?: IMastraLogger | false;
}

/**
 * MastraAdmin - Central orchestrator for the admin platform.
 * Like the Mastra class, this has business logic methods you call directly.
 */
export class MastraAdmin<...> extends MastraBase {
  #storage: TStorage;
  #runner?: TRunner;
  #router?: TRouter;
  #source?: TSource;
  #license: LicenseValidator;
  #rbac: RBACManager;
  #orchestrator: BuildOrchestrator;

  constructor(config: MastraAdminConfig<...>) {
    // Initialize providers, validate license, set up RBAC
    // Create BuildOrchestrator with runner/router/source
  }

  async init(): Promise<void> {
    await this.#license.validate();
    await this.#storage.init();
  }

  // ============================================================
  // Team Management
  // ============================================================
  async createTeam(userId: string, input: CreateTeamInput): Promise<Team> {
    await this.#rbac.assertCanCreateTeam(userId);
    await this.#license.assertCanCreateTeam(await this.#storage.countTeams());
    return this.#storage.createTeam({ ...input, id: crypto.randomUUID() });
  }

  async getTeam(userId: string, teamId: string): Promise<Team> {
    await this.#rbac.assertPermission({ userId, teamId }, 'team:read');
    return this.#storage.getTeam(teamId);
  }

  async inviteMember(userId: string, teamId: string, email: string, role: TeamRole): Promise<TeamInvite> {
    await this.#rbac.assertPermission({ userId, teamId }, 'member:create');
    const invite = await this.#storage.createTeamInvite({ teamId, email, role, invitedBy: userId });
    await this.#email?.send({ to: email, template: 'team_invite', data: { invite } });
    return invite;
  }

  // ============================================================
  // Project Management
  // ============================================================
  async createProject(userId: string, teamId: string, input: CreateProjectInput): Promise<Project> {
    await this.#rbac.assertPermission({ userId, teamId }, 'project:create');
    await this.#license.assertCanCreateProject(await this.#storage.countProjects(teamId));
    return this.#storage.createProject({ ...input, teamId, id: crypto.randomUUID() });
  }

  async setEnvVar(userId: string, projectId: string, key: string, value: string, isSecret: boolean): Promise<void> {
    const project = await this.#storage.getProject(projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'env_var:update');
    const encrypted = await this.#encryption.encrypt(value);
    await this.#storage.setProjectEnvVar(projectId, { key, encryptedValue: encrypted, isSecret });
  }

  // ============================================================
  // Deployment Management
  // ============================================================
  async createDeployment(userId: string, projectId: string, input: CreateDeploymentInput): Promise<Deployment> {
    const project = await this.#storage.getProject(projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:create');
    return this.#storage.createDeployment({
      id: crypto.randomUUID(),
      projectId,
      type: input.type,
      branch: input.branch,
      slug: this.generateDeploymentSlug(input),
      status: 'pending',
      // ...
    });
  }

  async deploy(userId: string, deploymentId: string): Promise<Build> {
    const deployment = await this.#storage.getDeployment(deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:deploy');

    // Create build record (queued)
    const build = await this.#storage.createBuild({
      id: crypto.randomUUID(),
      deploymentId,
      trigger: 'manual',
      triggeredBy: userId,
      status: 'queued',
      queuedAt: new Date(),
    });

    // Optionally trigger immediate processing (or let worker pick it up)
    // this.#orchestrator.processNextBuild();

    return build;
  }

  async stop(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.#storage.getDeployment(deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'deployment:update');

    const server = await this.#storage.getRunningServerForDeployment(deploymentId);
    if (server) {
      await this.#router?.removeRoute(deploymentId);
      await this.#runner?.stop(server);
      await this.#storage.stopRunningServer(server.id);
    }
    await this.#storage.updateDeploymentStatus(deploymentId, 'stopped');
  }

  // ============================================================
  // Build Management
  // ============================================================
  async getBuild(userId: string, buildId: string): Promise<Build> {
    const build = await this.#storage.getBuild(buildId);
    const deployment = await this.#storage.getDeployment(build.deploymentId);
    const project = await this.#storage.getProject(deployment.projectId);
    await this.#rbac.assertPermission({ userId, teamId: project.teamId }, 'build:read');
    return build;
  }

  async getBuildLogs(userId: string, buildId: string): Promise<string> {
    await this.getBuild(userId, buildId); // Permission check
    return this.#storage.getBuildLogs(buildId);
  }

  // ============================================================
  // Getters for providers
  // ============================================================
  getStorage(): TStorage { return this.#storage; }
  getRunner(): TRunner | undefined { return this.#runner; }
  getRouter(): TRouter | undefined { return this.#router; }
  getLicense(): LicenseValidator { return this.#license; }
  getRBAC(): RBACManager { return this.#rbac; }
  getOrchestrator(): BuildOrchestrator { return this.#orchestrator; }
}
```

**FileStorageProvider Interface**:
```typescript
export interface FileStorageProvider {
  readonly type: 'local' | 's3' | 'gcs' | string;

  // Write a file
  write(path: string, content: Buffer | string): Promise<void>;

  // Read a file
  read(path: string): Promise<Buffer>;

  // List files matching a prefix/pattern
  list(prefix: string): Promise<FileInfo[]>;

  // Delete a file
  delete(path: string): Promise<void>;

  // Move/rename a file (for marking as processed)
  move(from: string, to: string): Promise<void>;

  // Check if file exists
  exists(path: string): Promise<boolean>;
}

export interface FileInfo {
  path: string;
  size: number;
  lastModified: Date;
}
```

**ProjectSourceProvider Interface**:
```typescript
// Abstract interface for project source operations
export interface ProjectSourceProvider {
  readonly type: 'local' | 'github' | string;

  // List available projects/repos
  listProjects(teamId: string): Promise<ProjectSource[]>;

  // Get project source details
  getProject(projectId: string): Promise<ProjectSource>;

  // Validate that a project source is accessible
  validateAccess(source: ProjectSource): Promise<boolean>;

  // Get the local path to the project (may involve cloning/copying)
  getProjectPath(source: ProjectSource, targetDir: string): Promise<string>;

  // Watch for changes (optional - for local dev)
  watchChanges?(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void;
}

export interface ProjectSource {
  id: string;
  name: string;
  type: 'local' | 'github' | string;
  path: string;           // Local path OR repo fullName for GitHub
  defaultBranch?: string;
  metadata?: Record<string, unknown>;
}
```

**EdgeRouterProvider Interface**:
```typescript
// Abstract interface for exposing Mastra servers to the internet
export interface EdgeRouterProvider {
  readonly type: 'local' | 'cloudflare' | string;

  // Register a route for a deployment
  registerRoute(config: RouteConfig): Promise<RouteInfo>;

  // Update an existing route (e.g., point to new server after deploy)
  updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo>;

  // Remove a route (during deployment teardown)
  removeRoute(routeId: string): Promise<void>;

  // Get current route info
  getRoute(deploymentId: string): Promise<RouteInfo | null>;

  // List all routes for a project
  listRoutes(projectId: string): Promise<RouteInfo[]>;

  // Health check a route
  checkRouteHealth(routeId: string): Promise<RouteHealthStatus>;
}

export interface RouteConfig {
  deploymentId: string;
  projectId: string;
  subdomain: string;              // e.g., "job-matching-agent" or "pr-456--job-matching-agent"
  targetHost: string;             // e.g., "localhost" or internal service name
  targetPort: number;             // e.g., 3001
  tls?: boolean;                  // Enable HTTPS (default: true for cloudflare)
}

export interface RouteInfo {
  routeId: string;
  deploymentId: string;
  publicUrl: string;              // e.g., "https://pr-456--job-matching-agent.company.com"
  status: 'pending' | 'active' | 'unhealthy' | 'error';
  createdAt: Date;
  lastHealthCheck?: Date;
}

export interface RouteHealthStatus {
  healthy: boolean;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
}
```

**LicenseValidator Interface**:
```typescript
export interface LicenseInfo {
  valid: boolean;
  tier: 'community' | 'team' | 'enterprise';
  features: LicenseFeature[];
  expiresAt: Date | null;
  maxTeams: number | null;        // null = unlimited
  maxUsersPerTeam: number | null;
  maxProjects: number | null;
  organizationName?: string;
}

export type LicenseFeature =
  | 'local-runner'
  | 'k8s-runner'
  | 'cloudflare-router'
  | 'github-source'
  | 'sso'
  | 'audit-logs'
  | 'advanced-rbac';

export class LicenseValidator {
  constructor(licenseKey: string);

  // Validate and decode the license
  validate(): Promise<LicenseInfo>;

  // Check if a specific feature is enabled
  hasFeature(feature: LicenseFeature): boolean;

  // Check resource limits
  canCreateTeam(currentCount: number): boolean;
  canAddTeamMember(teamId: string, currentCount: number): boolean;
  canCreateProject(teamId: string, currentCount: number): boolean;

  // Get license info (cached after first validate)
  getLicenseInfo(): LicenseInfo;
}
```

---

### LANE 1.5: @mastra/admin-server (Server Package)

**Plan File**: `2025-01-23-admin-server.md`
**Priority**: P0 (Required to expose MastraAdmin via HTTP)
**Dependencies**: LANE 1 (Core - MastraAdmin class must exist)
**Estimated Complexity**: Medium

**This package follows the same pattern as `@mastra/server`**: It's an HTTP wrapper that accepts a `MastraAdmin` instance and exposes its methods via HTTP routes. The business logic lives in `MastraAdmin`, not here.

**Scope**:
1. Package setup (`packages/admin-server/`)
2. **AdminServer class** - Main entry point:
   - Accepts `MastraAdmin` instance (injected)
   - Creates Hono HTTP server
   - Sets up routes that call MastraAdmin methods
   - Starts build worker (calls `admin.getOrchestrator().processNextBuild()`)
3. **HTTP Routes** - Thin wrappers around MastraAdmin methods:
   - `POST /api/teams` → `admin.createTeam(userId, body)`
   - `GET /api/teams/:id` → `admin.getTeam(userId, teamId)`
   - `POST /api/projects` → `admin.createProject(userId, teamId, body)`
   - `POST /api/deployments/:id/deploy` → `admin.deploy(userId, deploymentId)`
   - etc.
4. **Middleware**:
   - Auth middleware (extracts user from token via `admin.getAuth()`)
   - Error handling (converts MastraAdminError to HTTP responses)
   - Request logging
5. **Build Worker** - Background process:
   - Calls `admin.getOrchestrator().processNextBuild()` in a loop
   - Can run embedded or standalone

**Key Files to Create**:
```
packages/admin-server/
├── src/
│   ├── index.ts                          # Main exports
│   ├── server.ts                         # AdminServer class
│   │
│   ├── routes/
│   │   ├── index.ts                      # Route setup
│   │   ├── teams.ts                      # Team routes → admin.createTeam(), etc.
│   │   ├── projects.ts                   # Project routes → admin.createProject(), etc.
│   │   ├── deployments.ts                # Deployment routes → admin.deploy(), etc.
│   │   ├── builds.ts                     # Build routes → admin.getBuild(), etc.
│   │   └── webhooks.ts                   # Webhook routes
│   │
│   ├── middleware/
│   │   ├── auth.ts                       # Auth middleware (uses admin.getAuth())
│   │   ├── error-handler.ts              # Converts MastraAdminError to HTTP
│   │   └── request-logger.ts             # Request logging
│   │
│   ├── worker/
│   │   └── build-worker.ts               # Calls admin.getOrchestrator().processNextBuild()
│   │
│   └── types.ts                          # Server-specific types
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**AdminServer Class (HTTP Wrapper)**:
```typescript
import { Hono } from 'hono';
import type { MastraAdmin } from '@mastra/admin';

export interface AdminServerConfig {
  /** MastraAdmin instance - contains all business logic */
  admin: MastraAdmin;

  /** Server port */
  port?: number;
  host?: string;

  /** Enable build worker (processes build queue) */
  enableBuildWorker?: boolean;
  buildWorkerIntervalMs?: number;
}

/**
 * AdminServer - HTTP wrapper for MastraAdmin.
 * Like @mastra/server wraps Mastra, this wraps MastraAdmin.
 */
export class AdminServer {
  readonly app: Hono;
  private worker?: BuildWorker;

  constructor(private config: AdminServerConfig) {
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Auth middleware - extracts userId from token
    this.app.use('*', async (c, next) => {
      const token = c.req.header('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const user = await this.config.admin.getAuth().authenticateToken(token, c.req);
      if (!user) {
        return c.json({ error: 'Invalid token' }, 401);
      }

      c.set('userId', (user as any).id);
      await next();
    });

    // Error handler
    this.app.onError((err, c) => {
      if (err instanceof MastraAdminError) {
        return c.json(err.toJSON(), this.getStatusCode(err));
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    });
  }

  private setupRoutes(): void {
    const admin = this.config.admin;

    // Teams
    this.app.post('/api/teams', async (c) => {
      const userId = c.get('userId');
      const body = await c.req.json();
      const team = await admin.createTeam(userId, body);
      return c.json(team, 201);
    });

    this.app.get('/api/teams/:teamId', async (c) => {
      const userId = c.get('userId');
      const team = await admin.getTeam(userId, c.req.param('teamId'));
      return c.json(team);
    });

    // Projects
    this.app.post('/api/teams/:teamId/projects', async (c) => {
      const userId = c.get('userId');
      const body = await c.req.json();
      const project = await admin.createProject(userId, c.req.param('teamId'), body);
      return c.json(project, 201);
    });

    // Deployments
    this.app.post('/api/projects/:projectId/deployments', async (c) => {
      const userId = c.get('userId');
      const body = await c.req.json();
      const deployment = await admin.createDeployment(userId, c.req.param('projectId'), body);
      return c.json(deployment, 201);
    });

    this.app.post('/api/deployments/:deploymentId/deploy', async (c) => {
      const userId = c.get('userId');
      const build = await admin.deploy(userId, c.req.param('deploymentId'));
      return c.json(build, 202);
    });

    this.app.post('/api/deployments/:deploymentId/stop', async (c) => {
      const userId = c.get('userId');
      await admin.stop(userId, c.req.param('deploymentId'));
      return c.json({ success: true });
    });

    // Builds
    this.app.get('/api/builds/:buildId', async (c) => {
      const userId = c.get('userId');
      const build = await admin.getBuild(userId, c.req.param('buildId'));
      return c.json(build);
    });

    this.app.get('/api/builds/:buildId/logs', async (c) => {
      const userId = c.get('userId');
      const logs = await admin.getBuildLogs(userId, c.req.param('buildId'));
      return c.text(logs);
    });
  }

  async start(): Promise<void> {
    // Start build worker if enabled
    if (this.config.enableBuildWorker) {
      this.worker = new BuildWorker(
        this.config.admin.getOrchestrator(),
        this.config.buildWorkerIntervalMs,
      );
      this.worker.start(); // Don't await - runs in background
    }

    // Start HTTP server
    const port = this.config.port ?? 3000;
    console.log(`AdminServer listening on http://localhost:${port}`);
    // Hono serve logic here
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.stop();
    }
  }
}
```

**Build Worker** (calls into MastraAdmin's orchestrator):
```typescript
export class BuildWorker {
  private running = false;

  constructor(
    private orchestrator: BuildOrchestrator,
    private intervalMs: number = 5000,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    console.log('[BuildWorker] Started');

    while (this.running) {
      const processed = await this.orchestrator.processNextBuild();
      if (!processed) {
        await new Promise(r => setTimeout(r, this.intervalMs));
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('[BuildWorker] Stopped');
  }
}
```

**Usage Example**:
```typescript
import { MastraAdmin } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { LocalProcessRunner } from '@mastra/runner-local';
import { LocalEdgeRouter } from '@mastra/router-local';
import { LocalProjectSource } from '@mastra/source-local';
import { MastraAuthSupabase } from '@mastra/auth-supabase';
import { AdminServer } from '@mastra/admin-server';

// 1. Create MastraAdmin (like creating Mastra instance)
const admin = new MastraAdmin({
  licenseKey: process.env.LICENSE_KEY!,
  auth: new MastraAuthSupabase(),
  storage: new PostgresAdminStorage({ connectionString: process.env.DATABASE_URL! }),
  runner: new LocalProcessRunner(),
  router: new LocalEdgeRouter({ baseDomain: 'localhost' }),
  source: new LocalProjectSource({ basePaths: ['/projects'] }),
});
await admin.init();

// 2. You can use MastraAdmin directly (like using Mastra directly)
const team = await admin.createTeam('user-123', { name: 'Search Team', slug: 'search' });
const project = await admin.createProject('user-123', team.id, { name: 'job-matcher', ... });
await admin.deploy('user-123', project.id);

// 3. Or wrap it with AdminServer for HTTP access (like @mastra/server)
const server = new AdminServer({
  admin,
  port: 3000,
  enableBuildWorker: true,
});
await server.start();

// Now HTTP clients can:
// POST /api/teams → calls admin.createTeam()
// POST /api/deployments/:id/deploy → calls admin.deploy()
```

---

### LANE 2: @mastra/admin-pg (PostgreSQL Storage)

**Plan File**: `2025-01-23-admin-pg.md`
**Priority**: P0
**Dependencies**: LANE 1 (Core Package)
**Estimated Complexity**: High

**Scope**:
1. Package setup (`stores/admin-pg/`) - follows `stores/pg/` pattern
2. `PostgresAdminStorage` implementing `AdminStorage`
3. All PostgreSQL migrations/table creation:
   - users
   - teams
   - team_members
   - team_invites
   - team_installations
   - projects
   - project_env_vars
   - project_api_tokens
   - **deployments** (production, staging, preview per project)
   - **builds** (build queue and history)
   - **running_servers** (active server instances)
   - **routes** (edge router registrations)
   - roles
   - role_assignments
4. Domain-specific query implementations:
   - Deployment lifecycle (create, update status, list by project)
   - Build queue (enqueue, dequeue, update status)
   - Running server management (register, health update, cleanup)
5. Index creation for performance

**Key Files to Create**:
```
stores/admin-pg/
├── src/
│   ├── index.ts
│   ├── storage.ts
│   ├── migrations/
│   │   └── 001_initial.ts
│   ├── domains/
│   │   ├── users.ts
│   │   ├── teams.ts
│   │   ├── projects.ts
│   │   ├── builds.ts
│   │   └── rbac.ts
│   └── utils.ts
├── package.json
└── tsconfig.json
```

---

### LANE 3: Observability System (File-Based Ingestion)

The observability system is split into three sub-lanes that can be developed in sequence:

#### LANE 3a: @mastra/observability-writer (Core Writer)

**Plan File**: `2025-01-23-observability-writer.md`
**Priority**: P0
**Dependencies**: LANE 1 (Core Package for interfaces)
**Estimated Complexity**: Medium

**Scope**:
1. Package setup (`observability/writer/`)
2. `ObservabilityWriter` class that:
   - Accepts traces, spans, logs, metrics, scores
   - Batches events in memory (configurable batch size/flush interval)
   - Writes batches to `FileStorageProvider` as JSONL files
   - Handles file rotation (time-based or size-based)
   - Thread-safe event buffering
3. File naming convention: `{type}/{project_id}/{timestamp}_{uuid}.jsonl`
4. Graceful shutdown (flush pending events)

**Key Files to Create**:
```
observability/writer/
├── src/
│   ├── index.ts
│   ├── writer.ts                  # ObservabilityWriter class
│   ├── batcher.ts                 # Event batching logic
│   ├── file-naming.ts             # File path/naming conventions
│   ├── types.ts                   # Event types (Trace, Span, Log, etc.)
│   └── serializer.ts              # JSONL serialization
├── package.json
└── tsconfig.json
```

**ObservabilityWriter Interface**:
```typescript
export interface ObservabilityWriterConfig {
  fileStorage: FileStorageProvider;
  batchSize?: number;              // Default: 1000 events
  flushIntervalMs?: number;        // Default: 5000ms
  maxFileSize?: number;            // Default: 10MB
}

export class ObservabilityWriter {
  constructor(config: ObservabilityWriterConfig);

  // Write methods (non-blocking, buffers internally)
  recordTrace(trace: Trace): void;
  recordSpan(span: Span): void;
  recordLog(log: Log): void;
  recordMetric(metric: Metric): void;
  recordScore(score: Score): void;

  // Batch write
  recordEvents(events: ObservabilityEvent[]): void;

  // Force flush pending events
  flush(): Promise<void>;

  // Graceful shutdown
  shutdown(): Promise<void>;
}
```

---

#### LANE 3b: File Storage Adapters

**Plan File**: `2025-01-23-observability-file-storage.md`
**Priority**: P0 (Local), P2 (S3/GCS)
**Dependencies**: LANE 1 (Core Package for FileStorageProvider interface)
**Estimated Complexity**: Low (Local), Medium (S3/GCS)

**FileStorageProvider Interface** (defined in LANE 1):
```typescript
export interface FileStorageProvider {
  readonly type: 'local' | 's3' | 'gcs' | string;

  // Write a file
  write(path: string, content: Buffer | string): Promise<void>;

  // Read a file
  read(path: string): Promise<Buffer>;

  // List files matching a prefix/pattern
  list(prefix: string): Promise<FileInfo[]>;

  // Delete a file
  delete(path: string): Promise<void>;

  // Move/rename a file (for marking as processed)
  move(from: string, to: string): Promise<void>;

  // Check if file exists
  exists(path: string): Promise<boolean>;
}

export interface FileInfo {
  path: string;
  size: number;
  lastModified: Date;
}
```

**Implementations**:

##### @mastra/observability-file-local (P0 - MVP)
```
observability/file-local/
├── src/
│   ├── index.ts
│   ├── provider.ts                # LocalFileStorage implementation
│   └── types.ts
├── package.json
└── tsconfig.json
```

##### @mastra/observability-file-s3 (P2 - Future)
```
observability/file-s3/
├── src/
│   ├── index.ts
│   ├── provider.ts                # S3FileStorage implementation
│   └── types.ts
├── package.json
└── tsconfig.json
```

##### @mastra/observability-file-gcs (P2 - Future)
```
observability/file-gcs/
├── src/
│   ├── index.ts
│   ├── provider.ts                # GCSFileStorage implementation
│   └── types.ts
├── package.json
└── tsconfig.json
```

---

#### LANE 3c: @mastra/observability-clickhouse (ClickHouse + Ingestion Worker)

**Plan File**: `2025-01-23-observability-clickhouse.md`
**Priority**: P1
**Dependencies**: LANE 3a (Writer), LANE 3b (File Storage)
**Estimated Complexity**: Medium-High

**Scope**:
1. Package setup (`observability/clickhouse/`)
2. ClickHouse schema and table creation:
   - traces, spans, logs, metrics, scores
   - Materialized views for aggregations
3. `ClickHouseQueryProvider` for reading/querying data
4. **Ingestion Worker** that:
   - Watches file storage for new JSONL files
   - Reads and parses files in batches
   - Bulk inserts into ClickHouse
   - Moves processed files to `processed/` directory (or deletes)
   - Handles failures with retry logic
   - Can run as standalone process or embedded

**Key Files to Create**:
```
observability/clickhouse/
├── src/
│   ├── index.ts
│   ├── schema.ts                  # ClickHouse table definitions
│   ├── migrations.ts              # Schema migrations
│   ├── query-provider.ts          # ClickHouseQueryProvider for reads
│   ├── queries/
│   │   ├── traces.ts
│   │   ├── spans.ts
│   │   ├── logs.ts
│   │   ├── metrics.ts
│   │   └── analytics.ts
│   ├── materialized-views.ts
│   ├── ingestion/
│   │   ├── worker.ts              # IngestionWorker class
│   │   ├── file-processor.ts      # JSONL file parsing
│   │   ├── bulk-insert.ts         # ClickHouse bulk insert
│   │   └── state.ts               # Track processed files
│   └── cli.ts                     # CLI for running worker standalone
├── package.json
└── tsconfig.json
```

**Ingestion Worker Interface**:
```typescript
export interface IngestionWorkerConfig {
  fileStorage: FileStorageProvider;
  clickhouse: ClickHouseClient;
  pollIntervalMs?: number;         // Default: 10000ms
  batchSize?: number;              // Files to process per batch
  processedDir?: string;           // Where to move processed files
  deleteAfterProcess?: boolean;    // Delete instead of move
  retryAttempts?: number;          // Default: 3
}

export class IngestionWorker {
  constructor(config: IngestionWorkerConfig);

  // Start the worker (runs continuously)
  start(): Promise<void>;

  // Stop the worker gracefully
  stop(): Promise<void>;

  // Process files once (for cron-based execution)
  processOnce(): Promise<ProcessingResult>;

  // Get worker status
  getStatus(): WorkerStatus;
}

export interface ProcessingResult {
  filesProcessed: number;
  eventsIngested: number;
  errors: ProcessingError[];
  duration: number;
}
```

**Running the Worker**:
```bash
# As standalone process
npx @mastra/observability-clickhouse ingest \
  --file-storage-type local \
  --file-storage-path /var/mastra/observability \
  --clickhouse-url http://localhost:8123 \
  --poll-interval 10000

# Or as part of Docker Compose (recommended)
# See LANE 8 for Docker configuration
```

---

### LANE 4: @mastra/source-local (Local Project Source)

**Plan File**: `2025-01-23-source-local.md`
**Priority**: P0 (MVP - enables development and testing without external services)
**Dependencies**: LANE 1 (Core Package for ProjectSourceProvider interface)
**Estimated Complexity**: Low

**Scope**:
1. Package setup (`sources/local/`)
2. `LocalProjectSource` implementing `ProjectSourceProvider`
3. Local filesystem operations:
   - Configure base directories where Mastra projects live
   - Scan directories for valid Mastra projects (detect by package.json, mastra config)
   - List discovered projects
   - Validate project accessibility
4. Project path resolution:
   - Return the local path directly (no cloning needed)
   - Validate path exists and is accessible
5. File watching (optional for hot reload):
   - Watch for file changes in project directories
   - Notify runner of changes for dev mode

**Key Files to Create**:
```
sources/local/
├── src/
│   ├── index.ts
│   ├── provider.ts                    # LocalProjectSource implementation
│   ├── types.ts                       # Local-specific types
│   ├── scanner.ts                     # Directory scanner for Mastra projects
│   ├── validator.ts                   # Project validation (is it a valid Mastra project?)
│   └── watcher.ts                     # File change watcher (optional)
├── package.json
└── tsconfig.json
```

**Key Types**:
```typescript
// Configuration for local project source
export interface LocalProjectSourceConfig {
  // Base directories to scan for projects
  basePaths: string[];

  // Glob patterns to include/exclude
  include?: string[];
  exclude?: string[];

  // Whether to watch for file changes
  watchChanges?: boolean;
}

// Local project source implementation
export class LocalProjectSource implements ProjectSourceProvider {
  readonly type = 'local' as const;

  constructor(private config: LocalProjectSourceConfig) {}

  async listProjects(teamId: string): Promise<ProjectSource[]> {
    // Scan basePaths for valid Mastra projects
    // Return list of discovered projects
  }

  async getProject(projectId: string): Promise<ProjectSource> {
    // Return project details by ID (path-based ID)
  }

  async validateAccess(source: ProjectSource): Promise<boolean> {
    // Check if path exists and is readable
  }

  async getProjectPath(source: ProjectSource, targetDir: string): Promise<string> {
    // For local, just return the source path directly
    // (no copying needed - runner uses the path directly)
    return source.path;
  }

  watchChanges(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void {
    // Use chokidar or similar to watch for changes
    // Return cleanup function
  }
}

// Project detection helper
export interface MastraProjectDetector {
  // Detect if a directory contains a Mastra project
  isMastraProject(dir: string): Promise<boolean>;

  // Get project metadata from directory
  getProjectMetadata(dir: string): Promise<ProjectMetadata>;
}

export interface ProjectMetadata {
  name: string;
  version?: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  hasMastraConfig: boolean;
  entryPoint?: string;
}
```

**Use Cases**:
- **Development**: Point to local Mastra repo for testing
- **Self-Hosted MVP**: Simple deployment without GitHub integration
- **CI/CD**: Runner fetches from local checkout

**Critical for**:
- **Runner (LANE 5)**: Uses `getProjectPath()` to get project location
- **UI (LANE 9)**: Uses `listProjects()` to show available local projects

---

### LANE 5: @mastra/runner-local (LocalProcess Runner)

**Plan File**: `2025-01-23-runner-local.md`
**Priority**: P0
**Dependencies**: LANE 1 (Core Package), LANE 4 (Local Source - for project path resolution), LANE 12 (Local Router - for route registration)
**Estimated Complexity**: Medium

**Scope**:
1. Package setup (`runners/local/`)
2. `LocalProcessRunner` implementing `ProjectRunner`
3. Project source integration:
   - Uses `ProjectSourceProvider.getProjectPath()` to get project location
   - Works with any source adapter (local, GitHub, etc.)
4. Build process (npm/pnpm/yarn/bun detection)
5. Process spawning and management
6. Port allocation
7. Health check implementation
8. Log collection
9. **Edge router integration**:
   - Register route after deployment starts
   - Update route when redeploying
   - Remove route when deployment stops

**Runner + Router Integration**:
```typescript
// Runner receives providers from MastraAdmin
class LocalProcessRunner implements ProjectRunner {
  constructor(
    private source: ProjectSourceProvider,
    private router: EdgeRouterProvider,
  ) {}

  async deploy(deployment: Deployment): Promise<RunningServer> {
    const project = await this.getProject(deployment.projectId);

    // 1. Get project source
    const projectPath = await this.prepareSource(project);

    // 2. Build the project
    await this.build(projectPath);

    // 3. Start the server
    const port = await this.allocatePort();
    const process = await this.startProcess(projectPath, port);

    // 4. Wait for health check
    await this.waitForHealthy(`http://localhost:${port}`);

    // 5. Register route with edge router
    const routeInfo = await this.router.registerRoute({
      deploymentId: deployment.id,
      projectId: project.id,
      subdomain: this.generateSubdomain(project, deployment),
      targetHost: 'localhost',
      targetPort: port,
    });

    // 6. Return running server info
    return {
      id: generateId(),
      deploymentId: deployment.id,
      buildId: deployment.currentBuildId!,
      host: 'localhost',
      port,
      processId: process.pid,
      healthStatus: 'healthy',
      publicUrl: routeInfo.publicUrl,
      startedAt: new Date(),
    };
  }

  async stop(serverId: string): Promise<void> {
    const server = await this.getServer(serverId);

    // 1. Remove route first
    await this.router.removeRoute(server.deploymentId);

    // 2. Stop the process
    await this.killProcess(server.processId);

    // 3. Release port
    this.releasePort(server.port);
  }

  private generateSubdomain(project: Project, deployment: Deployment): string {
    // production: "job-matching-agent"
    // staging: "staging--job-matching-agent"
    // preview: "pr-456--job-matching-agent"
    if (deployment.type === 'production') {
      return project.slug;
    }
    return `${deployment.slug}--${project.slug}`;
  }
}
```

**Key Files to Create**:
```
runners/local/
├── src/
│   ├── index.ts
│   ├── runner.ts
│   ├── port-allocator.ts
│   ├── package-manager.ts
│   ├── health-check.ts
│   └── subdomain.ts              # Subdomain generation logic
├── package.json
└── tsconfig.json
```

---

### LANE 6: Simple Providers (Part of Core)

**Included in LANE 1 plan**
**Priority**: P0
**Dependencies**: Part of Core

These are simple enough to include in the core package:
- `NoBillingProvider` - Returns "enterprise" subscription for self-hosted
- `ConsoleEmailProvider` - Logs emails to console for development
- `NodeCryptoEncryptionProvider` - AES-256-GCM encryption using Node.js crypto

---

### LANE 7: Integration Tests

**Plan File**: `2025-01-23-admin-integration-tests.md`
**Priority**: P1
**Dependencies**: LANES 1-5 (All providers)
**Estimated Complexity**: Medium

**Scope**:
1. Test fixtures and setup
2. Docker Compose for test dependencies
3. E2E test scenarios:
   - User registration and authentication (using `@mastra/auth-supabase`)
   - Team creation and member management
   - Project CRUD operations
   - Build and deployment lifecycle
   - Observability data flow
4. RBAC permission testing

---

### LANE 8: Docker Self-Hosting

**Plan File**: `2025-01-23-admin-docker.md`
**Priority**: P1
**Dependencies**: LANES 1-5, LANE 3c (Core implementation + Ingestion Worker)
**Estimated Complexity**: Medium

**Scope**:
1. Dockerfile for admin server
2. Dockerfile for ingestion worker
3. Docker Compose configuration:
   - Admin server
   - PostgreSQL
   - ClickHouse
   - **Ingestion Worker** (syncs files → ClickHouse)
   - (Optional) Redis for caching
4. Volume mounts for:
   - PostgreSQL data
   - ClickHouse data
   - **Observability file storage** (shared between admin server and worker)
5. Environment variable documentation
6. Network configuration
7. Health checks
8. Self-hosting documentation

**Key Files to Create**:
```
deploy/
├── docker/
│   ├── Dockerfile.admin           # Admin server
│   ├── Dockerfile.worker          # Ingestion worker
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── .env.example
│   └── README.md
```

**Docker Compose Services**:
```yaml
services:
  admin:
    build:
      context: .
      dockerfile: Dockerfile.admin
    environment:
      - OBSERVABILITY_FILE_STORAGE_PATH=/data/observability
    volumes:
      - observability-data:/data/observability

  ingestion-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - FILE_STORAGE_PATH=/data/observability
      - CLICKHOUSE_URL=http://clickhouse:8123
      - POLL_INTERVAL_MS=10000
    volumes:
      - observability-data:/data/observability  # Shared with admin
    depends_on:
      - clickhouse

  postgres:
    image: postgres:16
    volumes:
      - postgres-data:/var/lib/postgresql/data

  clickhouse:
    image: clickhouse/clickhouse-server:24
    volumes:
      - clickhouse-data:/var/lib/clickhouse

volumes:
  observability-data:    # Shared between admin and worker
  postgres-data:
  clickhouse-data:
```

---

### LANE 9: @mastra/admin-ui (Admin Dashboard)

**Plan File**: `2025-01-23-admin-ui.md`
**Priority**: P1
**Dependencies**: LANES 1-5 (Backend complete), LANE 4 (Local Source for project listing)
**Estimated Complexity**: High

**Scope**:
1. Package setup (`packages/admin-ui/`)
2. Tech stack selection (Next.js/React, likely reuse playground-ui patterns)
3. Authentication flow (integrates with Supabase Auth)
4. Dashboard pages:
   - Login/signup
   - Team management
   - Project list and detail
   - Build logs and status
   - Environment variables management
   - Observability dashboard (traces, logs, metrics)
   - Team member management
   - RBAC role assignment
5. **Project Source flows**:
   - Project source picker (lists projects from `ProjectSourceProvider.listProjects()`)
   - Source type indicator (local vs GitHub when available)
   - Project validation status
6. API client for admin backend

**Project Source UI Components**:
```typescript
// Project Source Picker Component
function ProjectSourcePicker({ teamId, onSelect }) {
  const { data: projects } = useQuery(['projects', teamId],
    () => adminClient.source.listProjects(teamId)
  );

  return (
    <Select onValueChange={onSelect}>
      {projects?.map(project => (
        <SelectItem key={project.id} value={project.id}>
          <SourceTypeIcon type={project.type} />
          {project.name}
          <span className="text-muted">{project.path}</span>
        </SelectItem>
      ))}
    </Select>
  );
}

// Source type indicator
function SourceTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'local':
      return <FolderIcon className="text-blue-500" />;
    case 'github':
      return <GithubIcon className="text-gray-700" />;
    default:
      return <CodeIcon />;
  }
}
```

**Key Structure**:
```
packages/admin-ui/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/
│   │   ├── teams/
│   │   ├── projects/
│   │   ├── builds/
│   │   └── settings/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── styles/
├── package.json
└── tsconfig.json
```

---

### LANE 10: @mastra/runner-k8s (Kubernetes Runner)

**Plan File**: `2025-01-23-runner-k8s.md`
**Priority**: P2 (Future)
**Dependencies**: LANE 1 (Core Package)
**Estimated Complexity**: High

**Scope**:
1. Package setup (`runners/k8s/`)
2. `KubernetesRunner` implementing `ProjectRunner`
3. Deployment, Service, Ingress creation
4. ConfigMap and Secret management
5. Health check via K8s probes
6. Log streaming from pods
7. Scaling configuration

**Key Files to Create**:
```
runners/k8s/
├── src/
│   ├── index.ts
│   ├── runner.ts
│   ├── manifests/
│   │   ├── deployment.ts
│   │   ├── service.ts
│   │   └── ingress.ts
│   ├── client.ts
│   └── logs.ts
├── package.json
└── tsconfig.json
```

---

### LANE 11: @mastra/source-github (GitHub Project Source)

**Plan File**: `2025-01-23-source-github.md`
**Priority**: P2 (Future Enhancement)
**Dependencies**: LANE 1 (Core Package for ProjectSourceProvider interface)
**Estimated Complexity**: Medium-High

**Scope**:
1. Package setup (`sources/github/`)
2. `GitHubProjectSource` implementing `ProjectSourceProvider`
3. GitHub App authentication:
   - App JWT generation using private key
   - Installation access token generation
   - Token caching and refresh
4. Repository operations:
   - List user's accessible repositories
   - List organization repositories
   - Get repository details
   - Check repository access permissions
5. Installation management:
   - Handle GitHub App installation events
   - Store/retrieve installation IDs per team
   - Validate installation access
6. Webhook handling:
   - `installation` events (created, deleted, suspend, unsuspend)
   - `push` events (for auto-deploy triggers)
   - `repository` events (for sync)
   - Webhook signature verification
7. Clone URL generation and cloning:
   - Generate authenticated clone URLs using installation tokens
   - Clone repos to target directory

**Key Files to Create**:
```
sources/github/
├── src/
│   ├── index.ts
│   ├── provider.ts                    # GitHubProjectSource implementation
│   ├── types.ts                       # GitHub-specific types
│   ├── auth/
│   │   ├── jwt.ts                     # GitHub App JWT generation
│   │   ├── installation-token.ts     # Installation access token management
│   │   └── token-cache.ts            # Token caching with TTL
│   ├── api/
│   │   ├── client.ts                 # GitHub REST API client
│   │   ├── repositories.ts           # Repository operations
│   │   ├── installations.ts          # Installation management
│   │   └── rate-limit.ts             # Rate limit handling
│   ├── webhooks/
│   │   ├── handler.ts                # Webhook request handler
│   │   ├── verify.ts                 # Signature verification
│   │   └── events.ts                 # Event type handlers
│   └── clone.ts                       # Git clone operations
├── package.json
└── tsconfig.json
```

**Key Types**:
```typescript
// GitHub implementation of ProjectSourceProvider
export class GitHubProjectSource implements ProjectSourceProvider {
  readonly type = 'github' as const;

  constructor(private config: GitHubAppConfig) {}

  async listProjects(teamId: string): Promise<ProjectSource[]> {
    // Get installation for team
    // List repositories accessible via installation
    // Convert to ProjectSource format
  }

  async getProjectPath(source: ProjectSource, targetDir: string): Promise<string> {
    // Get installation token
    // Generate authenticated clone URL
    // Clone to targetDir
    return targetDir;
  }
}

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  clientId?: string;
  clientSecret?: string;
}
```

**When to Implement**:
- After MVP is working with local source
- When teams need private repository access
- When auto-deploy from push is required

---

### LANE 12: @mastra/router-local (Local Edge Router)

**Plan File**: `2025-01-23-router-local.md`
**Priority**: P0 (MVP - required for exposing services locally)
**Dependencies**: LANE 1 (Core Package for EdgeRouterProvider interface)
**Estimated Complexity**: Low-Medium

**Scope**:
1. Package setup (`routers/local/`)
2. `LocalEdgeRouter` implementing `EdgeRouterProvider`
3. Local routing strategies:
   - Port mapping (direct port exposure)
   - Local reverse proxy (optional, using http-proxy)
   - Hosts file management (optional, for custom local domains)
4. Route registration and management
5. Health checking for local services
6. Development-friendly features:
   - Auto-reload on route changes
   - Console logging of routes
   - Local HTTPS support (self-signed certs)

**Key Files to Create**:
```
routers/local/
├── src/
│   ├── index.ts
│   ├── router.ts                     # LocalEdgeRouter implementation
│   ├── types.ts                      # Local-specific config types
│   ├── port-mapper.ts                # Simple port mapping strategy
│   ├── proxy.ts                      # Optional reverse proxy
│   └── health.ts                     # Local health checking
├── package.json
└── tsconfig.json
```

**Key Types**:
```typescript
export interface LocalEdgeRouterConfig {
  // Base domain for local routing (default: localhost)
  baseDomain?: string;

  // Port range for allocating routes
  portRange?: { start: number; end: number };

  // Enable reverse proxy mode (routes all through single port)
  useProxy?: boolean;
  proxyPort?: number;

  // Enable local HTTPS with self-signed certs
  enableHttps?: boolean;
}

export class LocalEdgeRouter implements EdgeRouterProvider {
  readonly type = 'local' as const;

  constructor(private config: LocalEdgeRouterConfig) {}

  async registerRoute(config: RouteConfig): Promise<RouteInfo> {
    // For simple mode: return direct port URL
    // e.g., http://localhost:3001
    //
    // For proxy mode: register with reverse proxy
    // e.g., http://job-matching-agent.localhost:8080
  }

  async updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo> {
    // Update target host/port for existing route
  }

  async removeRoute(routeId: string): Promise<void> {
    // Clean up route registration
  }

  async checkRouteHealth(routeId: string): Promise<RouteHealthStatus> {
    // HTTP health check to target
  }
}
```

**Use Cases**:
- **Local Development**: Developers testing MastraAdmin locally
- **CI/CD**: Integration tests with local services
- **Air-gapped Environments**: Deployments without internet access

---

### LANE 13: @mastra/router-cloudflare (Cloudflare Edge Router)

**Plan File**: `2025-01-23-router-cloudflare.md`
**Priority**: P2 (Future - production exposure)
**Dependencies**: LANE 1 (Core Package for EdgeRouterProvider interface)
**Estimated Complexity**: Medium-High

**Scope**:
1. Package setup (`routers/cloudflare/`)
2. `CloudflareEdgeRouter` implementing `EdgeRouterProvider`
3. Cloudflare Tunnel integration:
   - Tunnel creation and management
   - Ingress rule configuration
   - DNS record management
4. Authentication:
   - API token management
   - Account/zone configuration
5. Health checking via Cloudflare
6. TLS certificate management (automatic via Cloudflare)

**Key Files to Create**:
```
routers/cloudflare/
├── src/
│   ├── index.ts
│   ├── router.ts                     # CloudflareEdgeRouter implementation
│   ├── types.ts                      # Cloudflare-specific config types
│   ├── tunnel/
│   │   ├── manager.ts                # Tunnel lifecycle management
│   │   ├── ingress.ts                # Ingress rule configuration
│   │   └── connector.ts              # cloudflared connector management
│   ├── dns/
│   │   ├── records.ts                # DNS record management
│   │   └── zones.ts                  # Zone operations
│   ├── api/
│   │   ├── client.ts                 # Cloudflare API client
│   │   └── auth.ts                   # API token handling
│   └── health.ts                     # Health check via Cloudflare
├── package.json
└── tsconfig.json
```

**Key Types**:
```typescript
export interface CloudflareEdgeRouterConfig {
  // Cloudflare API credentials
  apiToken: string;
  accountId: string;

  // Zone for DNS records
  zoneId: string;
  baseDomain: string;              // e.g., "mastra.company.com"

  // Tunnel configuration
  tunnelId?: string;               // Existing tunnel or create new
  tunnelName?: string;             // Name for new tunnel

  // Connector options
  connectorMode: 'managed' | 'self-hosted';
}

export class CloudflareEdgeRouter implements EdgeRouterProvider {
  readonly type = 'cloudflare' as const;

  constructor(private config: CloudflareEdgeRouterConfig) {}

  async registerRoute(config: RouteConfig): Promise<RouteInfo> {
    // 1. Add ingress rule to tunnel config
    // 2. Create/update DNS CNAME record
    // 3. Return public URL (e.g., https://pr-456--job-agent.mastra.company.com)
  }

  async updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo> {
    // Update ingress rule target
  }

  async removeRoute(routeId: string): Promise<void> {
    // Remove ingress rule and DNS record
  }

  async checkRouteHealth(routeId: string): Promise<RouteHealthStatus> {
    // Check via Cloudflare health checks or direct probe
  }
}
```

**Deployment Architecture**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE TUNNEL ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Internet Traffic                                                           │
│         │                                                                    │
│         ▼                                                                    │
│   ┌───────────────────────────────────────┐                                 │
│   │         Cloudflare Edge Network        │                                 │
│   │   pr-456--job-agent.company.com        │                                 │
│   │   job-agent.company.com                │                                 │
│   │   support-bot.company.com              │                                 │
│   └───────────────────────────────────────┘                                 │
│                      │                                                       │
│                      │ Cloudflare Tunnel (encrypted)                         │
│                      ▼                                                       │
│   ┌───────────────────────────────────────┐                                 │
│   │         cloudflared connector          │  (runs alongside MastraAdmin)  │
│   │         (ingress rules)                │                                 │
│   │   ┌─────────────────────────────────┐ │                                 │
│   │   │ pr-456--job-agent → localhost:3001│ │                                 │
│   │   │ job-agent → localhost:3002        │ │                                 │
│   │   │ support-bot → localhost:3003      │ │                                 │
│   │   └─────────────────────────────────┘ │                                 │
│   └───────────────────────────────────────┘                                 │
│                      │                                                       │
│                      ▼                                                       │
│   ┌───────────────────────────────────────┐                                 │
│   │         Running Mastra Servers         │                                 │
│   └───────────────────────────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**When to Implement**:
- After MVP is working with local router
- When production internet exposure is needed
- When TLS/HTTPS is required without managing certificates

---

## Parallel Execution Strategy

### Phase 1: Foundation
- **LANE 1**: Core Package - Types, interfaces, abstract providers (including `ProjectSourceProvider`, `FileStorageProvider`, `EdgeRouterProvider`, `ObservabilityWriter`, `LicenseValidator`)
  - **NO business logic** - just contracts and types

### Phase 2: Providers (Parallel)
These can all run simultaneously after LANE 1 completes:
- **LANE 2**: PostgreSQL Storage (`stores/admin-pg/`)
- **LANE 3a**: Observability Writer (`observability/writer/`)
- **LANE 3b**: Local File Storage (`observability/file-local/`)
- **LANE 4**: Local Project Source (`sources/local/`)
- **LANE 5**: LocalProcess Runner (`runners/local/`)
- **LANE 6**: Simple Providers (part of core)
- **LANE 12**: Local Edge Router (`routers/local/`)

**Note**: Auth uses existing `@mastra/auth-supabase` - no implementation needed.

### Phase 2.5: Server (After Providers)
After LANE 2, 4, 5, 12 complete:
- **LANE 1.5**: Admin Server (`packages/admin-server/`)
  - Services: TeamService, ProjectService, DeploymentService, BuildService
  - BuildOrchestrator: The actual build → deploy → route flow
  - HTTP API: Hono routes for all operations
  - Build Worker: Background queue processor
  - **THIS IS WHERE THE ACTUAL OPERATIONS HAPPEN**

### Phase 2.5b: Observability Backend (Parallel with Server)
After LANE 3a and 3b complete:
- **LANE 3c**: ClickHouse + Ingestion Worker (`observability/clickhouse/`)

### Phase 3: Integration & Deployment (Parallel)
These can run simultaneously after Phase 2.5:
- **LANE 7**: Integration Tests (tests admin-server endpoints and flows)
- **LANE 8**: Docker Self-Hosting (includes admin-server, ingestion worker, postgres, clickhouse)
- **LANE 9**: Admin UI (`packages/admin-ui/`) - calls admin-server HTTP API

### Phase 4: Future Enhancements
- **LANE 3b-s3**: S3 File Storage (`observability/file-s3/`)
- **LANE 3b-gcs**: GCS File Storage (`observability/file-gcs/`)
- **LANE 10**: Kubernetes Runner (`runners/k8s/`)
- **LANE 11**: GitHub Project Source (`sources/github/`)
- **LANE 13**: Cloudflare Edge Router (`routers/cloudflare/`)

### Critical Path

The critical path to a working MVP is:

```
LANE 1 (Core)
    │
    ├── LANE 2 (admin-pg)     ─┐
    ├── LANE 4 (source-local) ─┼── LANE 1.5 (admin-server) ── LANE 7 (Integration) ── MVP!
    ├── LANE 5 (runner-local) ─┤
    └── LANE 12 (router-local)─┘
```

Without LANE 1.5, you have types and providers but nothing that uses them.

---

## Success Criteria for Master Plan

### Automated Verification:
- [ ] All packages build successfully: `pnpm build`
- [ ] All packages pass linting: `pnpm lint`
- [ ] All packages pass type checking: `pnpm typecheck`
- [ ] Unit tests pass for each package
- [ ] Integration tests pass

### Manual Verification (License & Core):
- [ ] License validation works with valid license key
- [ ] Feature gating prevents access to unlicensed features
- [ ] License expiration is handled gracefully

### Manual Verification (MVP - Local Source):
- [ ] Can create a MastraAdmin instance with all providers
- [ ] Can authenticate via existing `@mastra/auth-supabase`
- [ ] Can create teams, invite members
- [ ] Can configure local project source with base paths
- [ ] Can list local Mastra projects from configured directories
- [ ] Can create projects from local sources
- [ ] Can set env vars for projects

### Manual Verification (Deployments & Builds):
- [ ] Can create production deployment for a project
- [ ] Can create staging deployment for a project
- [ ] Can create preview deployments from branches
- [ ] Build queue correctly orders and processes builds
- [ ] Can trigger manual builds
- [ ] Can view build logs in real-time
- [ ] New deployments replace old ones after health check
- [ ] Failed builds don't affect running deployments

### Manual Verification (Edge Routing - Local):
- [ ] Local router correctly exposes services on allocated ports
- [ ] Routes are registered when deployments start
- [ ] Routes are removed when deployments stop
- [ ] Health checks correctly detect unhealthy services
- [ ] Multiple deployments per project have separate routes
- [ ] Preview deployments get unique URLs

### Manual Verification (Docker & UI):
- [ ] Docker Compose starts all services correctly
- [ ] Admin UI connects and functions properly
- [ ] Can manage deployments from Admin UI
- [ ] Can view running servers and their routes

### Manual Verification (Observability - File-Based Ingestion):
- [ ] ObservabilityWriter buffers and flushes events to JSONL files
- [ ] JSONL files are written to local file storage correctly
- [ ] File naming follows convention: `{type}/{project_id}/{timestamp}_{uuid}.jsonl`
- [ ] Ingestion worker picks up new files from file storage
- [ ] Ingestion worker bulk-inserts data into ClickHouse
- [ ] Processed files are moved to `processed/` directory
- [ ] Can query traces and metrics from ClickHouse via Admin UI
- [ ] Worker handles ClickHouse downtime gracefully (files queue up)
- [ ] Worker retries failed ingestion with backoff

### Manual Verification (Future - GitHub Source):
- [ ] Can install GitHub App and link to team
- [ ] Can list repositories from GitHub after installation
- [ ] Can create projects from GitHub repos (private and public)
- [ ] Can clone private repositories using installation tokens
- [ ] GitHub webhook events are received and processed

### Manual Verification (Future - Cloud File Storage):
- [ ] S3 file storage adapter writes/reads correctly
- [ ] GCS file storage adapter writes/reads correctly
- [ ] Ingestion worker can read from S3/GCS
- [ ] Cross-region replication works (if configured)

### Manual Verification (Future - Cloudflare Router):
- [ ] Cloudflare Tunnel is created and connected
- [ ] Ingress rules are correctly configured
- [ ] DNS records are created for deployments
- [ ] Public URLs are accessible from the internet
- [ ] TLS certificates are automatically provisioned
- [ ] Routes update when deployments change

---

## Individual Plan Creation

Each swim lane should have its own detailed implementation plan created in `thoughts/shared/plans/` following this naming convention:

| Lane | Plan File | Directory | Priority | Notes |
|------|-----------|-----------|----------|-------|
| 1 | `2025-01-23-admin-core.md` | `packages/admin/` | P0 | Types, interfaces only |
| **1.5** | **`2025-01-23-admin-server.md`** | **`packages/admin-server/`** | **P0** | **Services, API, orchestration** |
| 2 | `2025-01-23-admin-pg.md` | `stores/admin-pg/` | P0 | |
| 3a | `2025-01-23-observability-writer.md` | `observability/writer/` | P0 | |
| 3b | `2025-01-23-observability-file-storage.md` | `observability/file-local/` | P0 | |
| 3b-s3 | `2025-01-23-observability-file-s3.md` | `observability/file-s3/` | P2 | |
| 3b-gcs | `2025-01-23-observability-file-gcs.md` | `observability/file-gcs/` | P2 | |
| 3c | `2025-01-23-observability-clickhouse.md` | `observability/clickhouse/` | P1 | |
| 4 | `2025-01-23-source-local.md` | `sources/local/` | P0 | |
| 5 | `2025-01-23-runner-local.md` | `runners/local/` | P0 | |
| 7 | `2025-01-23-admin-integration-tests.md` | `packages/admin-server/` | P1 | Tests admin-server |
| 8 | `2025-01-23-admin-docker.md` | `deploy/docker/` | P1 | |
| 9 | `2025-01-23-admin-ui.md` | `packages/admin-ui/` | P1 | |
| 10 | `2025-01-23-runner-k8s.md` | `runners/k8s/` | P2 | |
| 11 | `2025-01-23-source-github.md` | `sources/github/` | P2 | |
| 12 | `2025-01-23-router-local.md` | `routers/local/` | P0 | |
| 13 | `2025-01-23-router-cloudflare.md` | `routers/cloudflare/` | P2 | |

Each individual plan should include:
1. Detailed file-by-file implementation
2. Code snippets for key components
3. Clear success criteria (automated + manual)
4. Dependencies on other lanes
5. Estimated phases within the lane

---

## Next Steps

1. Review and approve this master plan
2. Create individual plans for each lane (can be done in parallel)
3. Execute Phase 1 (Core Package)
4. Execute Phase 2 lanes in parallel
5. Execute Phase 3 lanes in parallel
6. Final integration and testing
