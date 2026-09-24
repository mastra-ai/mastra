---
'@mastra/clickhouse': minor
---

Added `runId`, `sessionId`, `userId`, and `organizationId` predicates to advanced trace queries at trace scope and inside `spans.some` / `spans.none`. The columns already existed, so no migration is needed. The store now advertises the `trace-query-context-ids` feature so the server can route these predicates to it.

Refs OBS-401
