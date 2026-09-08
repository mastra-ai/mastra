---
'@mastra/platform-workspace': patch
---

Fixed workspace providers to support `MASTRA_PLATFORM_SECRET_KEY` for local development while preserving precedence for explicit `accessToken` options and `MASTRA_PLATFORM_ACCESS_TOKEN`.
