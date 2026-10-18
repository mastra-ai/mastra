---
'@mastra/core': patch
---

Fixed `System message must be at the beginning` errors from models served through Chat Completions APIs (e.g. Qwen3.5/3.6 or Gemma 3 on vLLM). Multiple leading system messages are now merged into one for Chat Completions providers. Prompts are left unchanged when an earlier system message carries its own provider options (such as a cache breakpoint). Providers with a dedicated system field (Anthropic, Google, Bedrock) and the OpenAI Responses API are unchanged.
