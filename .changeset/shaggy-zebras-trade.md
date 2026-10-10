---
'@mastra/code-sdk': patch
---

Fixed the thinking level being ignored by more providers. It now reaches Groq, Mistral, xAI, OpenRouter, Together AI, DeepInfra, Cerebras, Perplexity and Alibaba models.

It also reaches every model routed through the Mastra gateway with an API key. That includes Claude, GPT and Gemini.

The thinking picker lists only the levels a model's request can carry. For example, GLM-5.2 through Mistral tops out at High instead of failing the request on Max. Off still leaves each model on its own default.
