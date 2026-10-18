---
'@mastra/core': patch
---

Fixed `System message must be at the beginning` errors with strict chat-template models (e.g. Qwen3.x on vLLM) behind OpenAI-compatible providers. Agents now work with these models without a proxy that rewrites prompts. OpenAI, Azure, Anthropic, Google and Bedrock prompts are unchanged.
