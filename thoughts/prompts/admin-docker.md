# LANE 8 - Docker Self-Hosting (after Phase 2)

Create implementation plan for LANE 8: Docker self-hosting setup for MastraAdmin.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANES 1-5, LANE 3c (Core implementation + Ingestion Worker) must be complete.

This includes:
- Dockerfile for admin server (deploy/docker/Dockerfile.admin)
- Dockerfile for ingestion worker (deploy/docker/Dockerfile.worker)
- Docker Compose configuration (deploy/docker/docker-compose.yml):
  - admin: Main admin server
  - ingestion-worker: Syncs files → ClickHouse
  - postgres: PostgreSQL 16
  - clickhouse: ClickHouse server
  - (Optional) redis: For caching
- Docker Compose for development (deploy/docker/docker-compose.dev.yml)
- Volume mounts:
  - postgres-data: PostgreSQL data persistence
  - clickhouse-data: ClickHouse data persistence
  - observability-data: Shared between admin server and worker
- Environment variable documentation (.env.example):
  - Database URLs
  - Auth configuration
  - Observability settings
  - License key
- Network configuration:
  - Internal network for services
  - Exposed ports for admin UI
- Health checks for all services
- Self-hosting documentation (README.md):
  - Prerequisites
  - Quick start guide
  - Configuration options
  - Troubleshooting

Save plan to: thoughts/shared/plans/2025-01-23-admin-docker.md
