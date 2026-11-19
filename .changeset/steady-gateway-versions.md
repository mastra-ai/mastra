---
'@mastra/server': patch
---

Studio now treats a `msk_` project key as a v1 Gateway key when it decides whether to use the v1 Gateway memory API, even when `MASTRA_GATEWAY_VERSION=v2` is set. This holds for every `@mastra/core` version the server supports. A registered `MastraGateway` and the key it uses decide between the v1 and v2 Gateway, so Studio agrees with the model calls. The memory API client is still built only from `MASTRA_GATEWAY_API_KEY` in the environment, so a key set only on the registered gateway does not enable it.
