---
'@mastra/server': patch
---

fixes Studio UI not showing custom gateway models. The /agents/providers endpoint now fetches providers from custom gateways registered with the Mastra instance and merges them with the static registry.
