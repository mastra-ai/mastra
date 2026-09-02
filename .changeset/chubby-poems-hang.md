---
'@mastra/core': patch
---

Exported the validateToolOutput helper from @mastra/core/tools so integrations can validate tool results against a schema and produce the same structured validation error as createTool.
