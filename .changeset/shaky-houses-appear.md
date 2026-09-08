---
'@mastra/factory': minor
---

Added a factory Supervisor that explains unhealthy work items, highlights actionable findings, and provides a dedicated factory-scoped chat without requiring a repository workspace.

Create or reconnect the factory-scoped session with `POST /web/factory/projects/:id/supervisor/session`, and read the current deterministic findings with `GET /web/factory/projects/:id/supervisor/health`.
