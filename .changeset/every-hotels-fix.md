---
'@mastra/factory': patch
'@mastra/core': patch
'@mastra/pg': patch
---

Observational-memory settings no longer fail with "No session for resourceId" on the settings page: OM config routes now treat the live session as best-effort sync and fall back to the durably stored per-user settings when no agent-controller session exists for the resource (e.g. after a server restart), so settings load and save instead of 404ing
