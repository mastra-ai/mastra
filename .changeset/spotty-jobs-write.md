---
'@mastra/server': patch
---

Fixed Studio showing the wrong provider for durable or dynamic agents that use a gateway model. An agent on `mastra/openai/gpt-5-mini` now shows the Mastra gateway instead of OpenAI, so Studio no longer asks for `OPENAI_API_KEY` when `MASTRA_GATEWAY_API_KEY` is set.
