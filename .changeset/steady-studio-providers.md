---
'@mastra/server': patch
---

Fixed Studio for projects that use the Mastra Gateway:

- The Gateway provider stays in the provider list, with no models, when its model list cannot be loaded (for example a revoked key or an outage). Before, it disappeared.
- "Enhance instructions" now works for agents on `mastra/...` models when only `MASTRA_GATEWAY_API_KEY` is set. Before, it returned "No model with a configured API key found".
- A `msk_` project key now always uses the v1 Gateway memory API, even when `MASTRA_GATEWAY_VERSION=v2` is set.
