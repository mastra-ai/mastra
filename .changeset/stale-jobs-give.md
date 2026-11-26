---
'@mastra/core': patch
---

Fixed web search failing with a 422 error when a custom gateway forwards `mastra/...` models to the Mastra gateway. A provider's native web search tool is now swapped for the gateway's web search on every `mastra/...` model, not only on models routed by the built-in Mastra gateway.
