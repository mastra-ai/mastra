---
'@mastra/core': patch
---

Fixed usage aggregation so omitted primary provider token counts remain unknown across agent, workflow, and durable streams while reported cache and reasoning details remain additive. Durable iteration state written by this version may omit unknown primary counters and cannot be resumed by an older worker after a rollback. (#23469)
