---
'@mastra/core': patch
---

fix(core): rehydrate built-in heartbeat workflow on boot when heartbeat schedules already exist

When a Mastra process restarts and the schedules store still has heartbeat rows
from a previous boot, the built-in `__mastra_heartbeat__` workflow is now
automatically re-registered during `startWorkers()`. Previously the workflow
was only registered lazily inside `agent.setHeartbeat()`, so cold boots with
persisted heartbeats would fail scheduler ticks with "workflow not found" and
404 from `getWorkflowById` when surfaced in Studio UI.
