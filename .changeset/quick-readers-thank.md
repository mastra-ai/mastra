---
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'mastra': patch
---

Fixed the Studio HTML injection of platform environment values: MASTRA_ORGANIZATION_ID, MASTRA_PLATFORM_PROJECT_ID, MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT and MASTRA_TELEMETRY_DISABLED are now escaped before being embedded in the served index.html, so values containing quotes, angle brackets or newlines can no longer corrupt the page. Also exported the new escapeStudioHtmlValue helper from @mastra/deployer/build.
