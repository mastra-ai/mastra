---
'@mastra/server': patch
---

Fixed Studio showing a provider as not connected (for example "Set OPENAI_API_KEY to use this provider") when a registered gateway authenticates it, such as the Mastra Code gateway with a ChatGPT subscription login. `GET /api/agents/providers` now reports these providers as `connected: true`. Fixes [#23668](https://github.com/mastra-ai/mastra/issues/23668).
