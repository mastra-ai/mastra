---
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
'@mastra/pg': minor
---

Added feedback deletion and idempotent feedback writes to the observability storage implementations:

- `deleteFeedback({ feedbackId })` removes a single feedback record and `deleteFeedbackByTraceIds({ traceIds })` erases all feedback linked to the given traces. Deleting traces with `batchDeleteTraces()` now also deletes their linked feedback.
- Feedback writes are deduplicated by `feedbackId`, so retrying a submission with the same client-supplied ID no longer creates duplicate records.
- `listFeedback` now supports filtering by `sourceId` to find all feedback linked to a specific record such as a message ID.

On ClickHouse, deletes use lightweight `DELETE` statements that hide rows from reads immediately; physical removal happens through background merges.
