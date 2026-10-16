---
'@mastra/deployer': patch
---

Servers built with `mastra build` now start model usage telemetry before serving requests, so shutdown reports include every model call the server handled.
