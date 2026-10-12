---
'@mastra/pg': patch
---

Fixed stale knowledge import workers committing PostgreSQL graph mutations after recovery while preserving legacy `importRunId`-only mutations.
