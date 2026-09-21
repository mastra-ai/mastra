---
'@mastra/client-js': patch
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added `name` to the generated `tracingOptions` request types so per-run root span names can be sent from the client. Related: https://github.com/mastra-ai/mastra/issues/24518
