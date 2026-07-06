---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
'@mastra/mysql': patch
'@mastra/convex': patch
'@mastra/spanner': patch
---

Schedule rows persisted with the legacy `target.type: 'heartbeat'` are now normalized to `target.type: 'agent'` when read, so existing agent schedules keep firing after the heartbeats-to-schedules rename in `@mastra/core`.
