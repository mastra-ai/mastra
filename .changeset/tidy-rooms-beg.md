---
'@mastra/code-sdk': patch
'mastracode': patch
---

Improved the error shown when a model provider is down or unreachable. Instead of a bare "Error: Not Found", Mastra Code now explains that the provider is unavailable, includes the HTTP status, and hints at checking the provider status page or switching models with /model.
