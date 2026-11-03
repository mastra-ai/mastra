---
'@mastra/code-sdk': patch
---

Fixed gateway-prefixed OpenAI and Anthropic model aliases losing web search tools and prompt guidance. Web search now matches how the model is reached: `mastra/` aliases using a Mastra gateway key get the gateway's `openrouter:web_search`, while direct API keys and Claude or Codex sign-ins keep the provider's native search. Prompt guidance lists `web_extract` only when a Parallel or Tavily backend provides it.
