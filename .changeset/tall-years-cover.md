---
'@mastra/playground-ui': minor
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'mastra': patch
---

**Signals now show live Entity-Learning data**

The Signals page is no longer static. Select an agent reported by the platform and Signals fetches that agent's signals and their clusters live from the Entity-Learning API, replacing the previous hardcoded mock data. Each available signal loads its real clusters (topics) and traces, with a scatter-plot chart for the selected topics.

**What changed**

- Added an agent filter at the top of the Signals page, mirroring the traces filter, so you can inspect signals for any agent on the server.
- The Signals overview and details pages now render live Entity-Learning topics, examples, and points directly, with shape-matching skeletons while data loads, centered empty states, and explicit error states.
- Clicking a cluster card opens its topic by default, and the Signals breadcrumbs preserve the selected entity and topic query params on back-navigation.

**Gating**

Studio's served HTML exposes `MASTRA_ORGANIZATION_ID`, `MASTRA_PLATFORM_PROJECT_ID`, and `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` to the browser so the Signals page can call the Entity-Learning API. The route is gated on the platform observability config, and the `MASTRA_SIGNALS_UI` flag guards the sidebar Signals nav link.
