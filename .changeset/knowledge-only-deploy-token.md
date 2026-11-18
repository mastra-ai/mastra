---
'@mastra/platform': patch
---

`PlatformKnowledge` now reads `MASTRA_KNOWLEDGE_ACCESS_TOKEN` before `MASTRA_PLATFORM_ACCESS_TOKEN`. Platform deploys get this Knowledge-only token alongside their Knowledge instance ID, so deployed agents can use Knowledge with Platform observability turned off, without being given the general project token.
