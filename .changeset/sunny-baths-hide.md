---
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'mastra': patch
---

Fixed `mastra studio` to escape platform environment values (MASTRA_ORGANIZATION_ID, MASTRA_PLATFORM_PROJECT_ID, MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT, MASTRA_TELEMETRY_DISABLED) before injecting them into the served Studio page, so values containing quotes or angle brackets can no longer corrupt it.
