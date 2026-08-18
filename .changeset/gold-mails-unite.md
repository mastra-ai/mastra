---
'mastra': minor
---

Added deploy-time setup for Mastra Cloud background workers. When a project statically enables background tasks, `mastra deploy` now offers to enable dedicated workers and attach managed Redis when needed before deployment. Declined, non-interactive, and `--yes` deploys warn and continue without creating infrastructure — background tasks keep running in-process on the API server.
