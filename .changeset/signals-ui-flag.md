---
'mastra': patch
'@mastra/deployer': patch
---

Gate the experimental Signals observability page behind a server-injected `MASTRA_SIGNALS_UI` runtime flag. The Studio HTML now exposes `window.MASTRA_SIGNALS_UI`, which the CLI and deployers populate from the `MASTRA_SIGNALS_UI` env var (default off). When disabled, the Signals sidebar item and `/signals` routes are not registered.
