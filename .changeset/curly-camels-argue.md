---
'@mastra/server': patch
'@mastra/core': patch
---

`GET /agents/providers` now fetches providers from all model gateways in parallel instead of one after another.
