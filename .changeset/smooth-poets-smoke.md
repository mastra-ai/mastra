---
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'mastra': patch
---

Fixed the Vercel deployer to escape platform environment values (MASTRA_ORGANIZATION_ID, MASTRA_PLATFORM_PROJECT_ID, MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT) before injecting them into the deployed Studio page.
