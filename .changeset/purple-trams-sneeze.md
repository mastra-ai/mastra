---
'@mastra/libsql': patch
---

Fixed stale knowledge import workers committing LibSQL graph mutations after recovery while preserving legacy `importRunId`-only mutations.
