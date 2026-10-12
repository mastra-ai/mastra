---
'@mastra/server': patch
---

`GET /agents/providers` responds faster when several model gateways are registered, because it now fetches providers from all gateways in parallel instead of one after another.
