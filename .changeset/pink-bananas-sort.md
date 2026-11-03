---
'@mastra/code-sdk': patch
---

Fixed gateway-prefixed OpenAI and Anthropic model aliases losing web search tools and prompt guidance. The search tool now follows the model's transport: `mastra/` aliases sent through the Mastra gateway's OpenRouter endpoint use `openrouter:web_search`, while direct keys and Claude or Codex OAuth keep the native provider search. Gateway acceptance of `openrouter:web_search` follows Mastra's own templates and has not been tested against the live gateway.
