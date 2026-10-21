---
'@mastra/factory': minor
---

Removed the Factory Supervisor. The supervisor chat session and its tools, the scheduled health check, the `POST /web/factory/projects/:id/supervisor/session` and `GET /web/factory/projects/:id/supervisor/health` routes, and the `supervisor-finding` attention kind no longer exist. Existing databases keep working: stored supervisor findings and their attention receipts are left in place and ignored.
