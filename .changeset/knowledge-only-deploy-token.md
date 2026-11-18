---
'@mastra/platform': patch
---

`PlatformKnowledge` now reads `MASTRA_KNOWLEDGE_ACCESS_TOKEN` when it is set, ahead of `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PLATFORM_SECRET_KEY`. An explicit `accessToken` option still wins, and an empty value is ignored. This is a Knowledge-only credential, so an app can authenticate to Knowledge without the general Platform token.
