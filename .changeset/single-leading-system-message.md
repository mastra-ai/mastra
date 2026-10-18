---
'@mastra/core': patch
---

Fixed `System message must be at the beginning` errors from models served through Chat Completions APIs (e.g. Qwen3.5/3.6 or Gemma 3 on vLLM, or on some OpenRouter hosts). Requests to Chat Completions providers now carry a single leading system message, and any later system message is sent as a user reminder. Providers with a dedicated system field (Anthropic, Google, Bedrock) and the OpenAI Responses API are unchanged.
