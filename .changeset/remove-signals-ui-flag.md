---
'@mastra/playground-ui': patch
'@mastra/deployer': patch
'mastra': patch
---

Remove the standalone `MASTRA_SIGNALS_UI` runtime flag. The Signals studio page is now shown whenever `PLATFORM_OBSERVABILITY_ENDPOINT` (window global `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT`) is set, since that endpoint is what supplies the page's entity-learning data. The separate `MASTRA_SIGNALS_UI` env var, its window global, and all of its HTML/Vite/CLI/deployer injection plumbing have been removed. Anyone who previously enabled Signals via `MASTRA_SIGNALS_UI=true` should set `PLATFORM_OBSERVABILITY_ENDPOINT` instead.
