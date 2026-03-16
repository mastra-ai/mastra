---
'@mastra/core': patch
---

Add AI Gateway tool support in the agentic loop.

Gateway tools (e.g., `gateway.tools.perplexitySearch()`) are provider-executed but, unlike native provider tools (e.g., `openai.tools.webSearch()`), the LLM provider does not store their results server-side. The agentic loop now correctly infers `providerExecuted` for these tools, merges streamed provider results with their corresponding tool calls, and skips local execution when a provider result is already present.

Fixes #13190
