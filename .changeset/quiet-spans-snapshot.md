---
'@mastra/observability': patch
---

Improved logger and metrics context creation so span metadata is copied once per context instead of twice. Emitted logs and metrics still keep the metadata captured when each context was created.
