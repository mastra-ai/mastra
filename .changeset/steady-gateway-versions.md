---
'@mastra/server': patch
---

A `msk_` project key now always uses the v1 Gateway memory API, even when `MASTRA_GATEWAY_VERSION=v2` is set. Studio follows a registered `MastraGateway` and its own key when deciding between the v1 and v2 Gateway, so it agrees with the model calls.
