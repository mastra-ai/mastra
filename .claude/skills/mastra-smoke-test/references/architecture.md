# Architecture Overview

> **Internal**: This document describes Mastra's internal cloud infrastructure. Useful for debugging but not required for basic smoke testing.

## Trace Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRACE INGESTION FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Deployed Server/Studio                                                     │
│         │                                                                   │
│         │ POST /ai/spans/publish                                            │
│         │ (Authorization: Bearer <MASTRA_CLOUD_ACCESS_TOKEN>)               │
│         ▼                                                                   │
│  ┌─────────────────┐                                                        │
│  │  mobs-collector │ ◄── Validates JWT using GATEWAY_JWT_SECRET             │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │ Pub/Sub                                                         │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │  mobs-ch-writer │ ◄── Writes to ClickHouse                               │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │   ClickHouse    │ ◄── mastra_ai_spans table                              │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │   mobs-query    │ ◄── GET /traces (requires session auth)                │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │ via edge-router                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │   Studio UI     │ ◄── Displays traces in Observability tab               │
│  └─────────────────┘                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Token Signing Flow

All services must use the same secret (`GATEWAY_JWT_SECRET`) for token signing and verification:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         JWT TOKEN FLOW                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SERVER DEPLOYS:                                                             │
│  ┌─────────────────┐     signs token      ┌─────────────────────────────┐   │
│  │  gateway-api /  │ ──────────────────►  │ MASTRA_CLOUD_ACCESS_TOKEN   │   │
│  │  platform-api   │   using              │ (injected into deployed     │   │
│  └─────────────────┘   GATEWAY_JWT_SECRET │  server's environment)      │   │
│                                           └─────────────────────────────┘   │
│                                                                              │
│  STUDIO DEPLOYS:                                                             │
│  ┌─────────────────┐     signs token      ┌─────────────────────────────┐   │
│  │  studio-runner  │ ──────────────────►  │ MASTRA_CLOUD_ACCESS_TOKEN   │   │
│  └─────────────────┘   using              │ (injected into deployed     │   │
│                        GATEWAY_JWT_SECRET │  studio's environment)      │   │
│                                           └─────────────────────────────┘   │
│                                                                              │
│  VERIFICATION:                                                               │
│  ┌─────────────────┐     verifies token   ┌─────────────────────────────┐   │
│  │  mobs-collector │ ◄────────────────────│ Incoming trace request      │   │
│  └─────────────────┘   using              └─────────────────────────────┘   │
│                        GATEWAY_JWT_SECRET                                    │
│                                                                              │
│  ⚠️  ALL THREE SERVICES MUST USE THE SAME SECRET!                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Service Relationships

### Platform Services (GCP Cloud Run)

| Service | Purpose | Key Config |
|---------|---------|------------|
| `gateway-platform-api` | Signs JWTs for server deploys, handles deploy requests | `GATEWAY_JWT_SECRET`, `MASTRA_CLOUD_TRACES_ENDPOINT` |
| `studio-runner` | Signs JWTs for studio deploys, manages Daytona sandboxes | `GATEWAY_JWT_SECRET`, `MASTRA_CLOUD_TRACES_ENDPOINT` |
| `mobs-collector` | Receives and validates trace spans | `GATEWAY_JWT_SECRET` |
| `mobs-ch-writer` | Writes spans from Pub/Sub to ClickHouse | - |
| `mobs-query` | Queries traces for Studio UI | Session auth |
| `edge-router` | Routes requests, proxies to mobs-query | `TELEMETRY_ENDPOINT` |

### GCP Projects

| Environment | Description |
|-------------|-------------|
| Staging | Used for testing before production rollout |
| Production | Live environment |

Access project IDs and numbers from the GCP Console if needed.

## Deploy Flow

```
User runs `mastra server deploy`
         │
         ▼
┌─────────────────────────┐
│  CLI builds project     │
│  Creates archive        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  POST to platform-api   │
│  /v1/server/projects    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  platform-api:          │
│  - Creates/finds project│
│  - Signs JWT token      │  ◄── Uses GATEWAY_JWT_SECRET
│  - Returns deploy config│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Server starts with:    │
│  - MASTRA_CLOUD_ACCESS_TOKEN (signed JWT)
│  - MASTRA_CLOUD_TRACES_ENDPOINT
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Server sends traces    │
│  to mobs-collector      │  ◄── Validates with GATEWAY_JWT_SECRET
└─────────────────────────┘
```
