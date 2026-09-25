---
'@mastra/inngest': patch
'@mastra/core': patch
---

Durable runs of stored agents now stay pinned to the agent version they started on. Both resuming a suspended run (#22128) and recovering a crashed run re-resolve the original pinned version instead of silently switching to the latest published version. If the pinned version no longer resolves, the run falls back to the current definition with a warning.
