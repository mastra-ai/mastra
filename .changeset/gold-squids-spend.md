---
'mastra': minor
'@mastra/deployer': patch
---

Added a dedicated worker entry to standard build artifacts. The worker runtime exposes a /health endpoint that returns 503 during startup and 200 after workers initialize, so deployment platforms can gate rollout on worker readiness.
