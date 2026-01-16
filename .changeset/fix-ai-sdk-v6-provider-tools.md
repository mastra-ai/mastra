---
"@mastra/core": patch
---

Fixed AI SDK v6 provider tools (like `openai.tools.webSearch()`) not being invoked correctly. These tools are now properly recognized and executed instead of causing failures or hallucinated tool calls.

Resolves `#11781`.
