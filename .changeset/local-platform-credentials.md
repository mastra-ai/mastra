---
'@mastra/platform-workspace': patch
---

Allow workspace providers to authenticate with `MASTRA_PLATFORM_SECRET_KEY` for local development. Explicit `accessToken` options take precedence, followed by `MASTRA_PLATFORM_ACCESS_TOKEN`, then `MASTRA_PLATFORM_SECRET_KEY`. Blank environment credentials are ignored.
