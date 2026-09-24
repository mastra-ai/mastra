---
'@mastra/clickhouse': minor
---

Added `runId`, `sessionId`, `userId`, and `organizationId` predicates to advanced trace queries at trace scope and inside `spans.some` / `spans.none`. The columns already existed, so no migration is needed.

Refs OBS-401
