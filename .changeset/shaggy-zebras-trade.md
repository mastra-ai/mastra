---
'@mastra/code-sdk': patch
---

Fixed the thinking level being ignored by Groq, Mistral, xAI, OpenRouter, Together AI, DeepInfra, Cerebras, Perplexity and Alibaba models, and by every model routed through the Mastra gateway with an API key, Claude, GPT and Gemini included. The thinking picker now lists only the levels a model's request can carry, and each request sends the level the picker shows, so GLM-5.2 through Mistral tops out at High instead of failing the request on Max. Off appears only on models that can stop thinking.
