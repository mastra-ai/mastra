---
"@mastra/memory": patch
---

Fix final assistant text being lost after tool-approval resume when Observational Memory is enabled. During resume, input processors are skipped so no OM turn is created. The OM processor now directly persists new response messages in `processOutputResult` when no active turn exists.
