---
'@mastra/pg': patch
---

Fixed the standard PostgresStore returning an unsupported-operation error from /observability/scores. Existing evaluator results in mastra_scorers are now available through the observability score API without requiring PostgresStoreVNext.
