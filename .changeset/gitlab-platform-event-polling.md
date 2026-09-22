---
'@mastra/factory': patch
---

Platform-connected GitLab deployments now receive issue, note, merge request and push events by polling the Platform event log, so they no longer need a direct project webhook to Factory or a shared `MASTRA_GITLAB_WEBHOOK_SECRET`. Polling is on by default and controlled with `MASTRA_PLATFORM_GITLAB_POLLING_ENABLED` and `MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS`.
