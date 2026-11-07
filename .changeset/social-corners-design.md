---
'@mastra/pg': patch
---

Fixed the standard PostgresStore returning an unsupported-operation error when listing or looking up observability scores. Existing evaluator results in mastra_scorers are now readable without requiring PostgresStoreVNext. Score writes remain owned by the legacy scores API; direct observability score creation and delta polling remain unsupported.
