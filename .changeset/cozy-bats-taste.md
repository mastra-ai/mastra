---
'@mastra/core': patch
---

Fixed cross-provider tool ID leaks where Anthropic server*tool_use IDs (srvtoolu*\*) were sent to OpenAI Responses API, causing 404 errors. Completed provider-executed tool calls are now filtered from model messages since their results are already captured in the conversation text.
