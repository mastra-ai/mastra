---
'@mastra/core': patch
---

Fixed web search failing with a 422 error on Mastra gateway models. Every request to the gateway's chat endpoint now has a provider's native web search tool swapped for the gateway's own web search, whether the model is reached through the built-in gateway, a custom gateway, or directly from `MastraGateway`.
