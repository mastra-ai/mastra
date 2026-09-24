---
'@mastra/server': patch
---

Advanced trace queries and thread queries now return `501 TRACE_QUERY_UNSUPPORTED` before storage runs when a predicate names `runId`, `sessionId`, `userId`, or `organizationId` and the configured observability store does not advertise the `trace-query-context-ids` feature. Field discovery hides those fields from such stores. This keeps a newer `@mastra/core` on an older store from failing with a 500.

Refs OBS-401
