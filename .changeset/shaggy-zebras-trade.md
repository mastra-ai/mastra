---
'@mastra/code-sdk': patch
---

Fixed the thinking level being ignored by Groq, Mistral, xAI (API key), OpenRouter, Together AI, DeepInfra, Cerebras, Perplexity and Alibaba models, and by models routed through the Mastra gateway. Requests now carry the level the model runs, in each provider's own reasoning setting. A level the provider does not accept runs as the closest one below it, so Max on GLM-5.2 through Mistral runs as High instead of failing the request. Off turns thinking off on models that can stop thinking.
