---
'@mastra/memory': patch
---

Observational memory failure markers now say which provider status and codes refused the Observer or Reflector call. When the model call fails, `data-om-observation-failed` and `data-om-buffering-failed` carry `providerError: { statusCode, codes }` beside the error message, so an app can tell a rate limit or an exhausted quota from other memory failures without matching the message. Refs [#28696](https://github.com/mastra-ai/mastra/issues/28696).
