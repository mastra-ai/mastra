---
'mastra': minor
---

Added deploy-time setup for Mastra Cloud background workers. When a project statically enables background tasks, `mastra deploy` now offers to enable dedicated workers and attach managed Redis when needed before deployment. Non-interactive deploys continue without creating infrastructure and show the required remediation.
