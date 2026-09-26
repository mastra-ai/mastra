---
'@mastra/code-sdk': patch
---

Mastra Code now uses the shared error recovery defaults from `@mastra/core`. It still repairs rejected message history and assistant-prefill errors before it retries, and it keeps its own tuned retry settings for network and server errors.
