# LANE 2 - PostgreSQL Storage (parallel with other Phase 2 lanes)

Create implementation plan for LANE 2: @mastra/admin-pg PostgreSQL storage.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANE 1 (Core Package) must be complete first.

This includes:
- stores/admin-pg/ package setup (follows stores/pg/ pattern)
- PostgresAdminStorage implementing AdminStorage interface
- All PostgreSQL migrations/table creation:
  - users, teams, team_members, team_invites, team_installations
  - projects, project_env_vars, project_api_tokens
  - deployments (production, staging, preview per project)
  - builds (build queue and history)
  - running_servers (active server instances)
  - routes (edge router registrations)
  - roles, role_assignments
- Domain-specific query implementations:
  - Deployment lifecycle (create, update status, list by project)
  - Build queue (enqueue, dequeue, update status)
  - Running server management (register, health update, cleanup)
- Index creation for performance

Save plan to: thoughts/shared/plans/2025-01-23-admin-pg.md
