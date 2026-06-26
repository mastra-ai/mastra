---
'@mastra/playground-ui': patch
'@mastra/deployer': patch
'mastra': patch
---

Add a dedicated `PLATFORM_OBSERVABILITY_ENDPOINT` env var (injected as the `MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT` window global) for entity-learning fetching. When set, the signals entity-learning hooks use it as the base for `/entity-learning/*` requests and gate on its presence, instead of reusing `MASTRA_CLOUD_API_ENDPOINT` (which doubles as the main playground client base URL). Existing behavior is preserved: when the new endpoint is absent, hooks fall back to `MASTRA_CLOUD_API_ENDPOINT`. The global is templated through the CLI studio command, the standalone Vite dev server, and the deployer studio HTML injection so it reaches the browser at runtime.
