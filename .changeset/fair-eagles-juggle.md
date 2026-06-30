---
'@mastra/playground-ui': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'mastra': patch
---

**Signals UI gating now uses the platform observability endpoint**

Studio's served HTML now exposes `MASTRA_ORGANIZATION_ID`, `MASTRA_PLATFORM_PROJECT_ID`, and `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` to the browser so the Signals page can call the Entity-Learning API.

The removed `MASTRA_SIGNALS_UI` flag no longer controls Signals. Set `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` to enable the Signals UI; leave it unset to hide it.
