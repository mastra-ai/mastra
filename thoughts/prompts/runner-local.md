# LANE 5 - LocalProcess Runner (parallel with other Phase 2 lanes)

Create implementation plan for LANE 5: @mastra/runner-local LocalProcess runner.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**:
- LANE 1 (Core Package) must be complete first
- LANE 4 (Local Source) for project path resolution
- LANE 12 (Local Router) for route registration

This includes:
- runners/local/ package setup
- LocalProcessRunner implementing ProjectRunner interface
- Project source integration:
  - Uses ProjectSourceProvider.getProjectPath() to get project location
  - Works with any source adapter (local, GitHub, etc.)
- Build process:
  - Package manager detection (npm/pnpm/yarn/bun)
  - Install dependencies
  - Build project
- Process spawning and management:
  - Spawn Mastra server as child process
  - Capture stdout/stderr
  - Handle process lifecycle
- Port allocation:
  - Allocate available ports
  - Track port usage
  - Release ports on shutdown
- Health check implementation:
  - HTTP health checks
  - Configurable timeout and retry
- Log collection from processes
- Edge router integration:
  - Register route after deployment starts
  - Update route when redeploying
  - Remove route when deployment stops
- Subdomain generation logic:
  - production: "{project-slug}"
  - staging: "staging--{project-slug}"
  - preview: "{branch}--{project-slug}"

Save plan to: thoughts/shared/plans/2025-01-23-runner-local.md
