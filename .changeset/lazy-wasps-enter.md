---
"@mastra/clickhouse": minor
---

Fixed anonymous feedback appearing to come from the trace user when its author is explicitly null.

ClickHouse reads preserve a null `feedbackUserId` and only fall back to `userId` when the author column is absent from the result. Historical rows with a null author are returned as anonymous, including nulls introduced by an earlier schema change.
