---
'@mastra/server': patch
---

Fixed agent `defaultOptions.modelSettings.maxOutputTokens` being silently dropped when saving an agent through the API. The legacy `maxTokens` key is still accepted.
