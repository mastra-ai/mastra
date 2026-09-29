---
'@mastra/server': patch
'@mastra/client-js': patch
---

Fixed Studio hiding processors that only implement `processLLMRequest`, such as `ToolCallFilter`. The processors API now reports an `llmRequest` phase for these processors, so they appear in the Processors page, sidebar, and picker. Running this phase directly from Studio returns a clear 400 error because it operates on the provider prompt during an agent call.
