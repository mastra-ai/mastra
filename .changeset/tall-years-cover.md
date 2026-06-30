---
'@mastra/playground-ui': minor
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'mastra': patch
---

**Signals now show live Entity-Learning data with an entity filter**

The Signals page is no longer static. Pick any entity type and entity reported by the platform (agents, tools, workflows, and more), and Signals fetches that entity's signals and their clusters live from the Entity-Learning API.

**What changed**

- Added an entity-type/entity filter at the top of the Signals page, mirroring the traces filter, so you can inspect signals for any supported entity on the server.
- Each available signal for the selected entity now loads its real clusters (topics) by entity id and organization id instead of hardcoded mock data.

**Heads up**
The Signals UI is now gated on the platform observability endpoint being configured, instead of the removed `MASTRA_SIGNALS_UI` flag. Set `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` (along with `MASTRA_ORGANIZATION_ID` and `MASTRA_PLATFORM_PROJECT_ID`) to enable Signals.
