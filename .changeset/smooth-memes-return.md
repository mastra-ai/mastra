---
'@mastra/pg': patch
---

Canonical JSONB workflow snapshots now use a compact writer query for workflow execution state reads, while other snapshot representations retain the established full snapshot path.
