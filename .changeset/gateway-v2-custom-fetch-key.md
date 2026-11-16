---
'@mastra/core': patch
---

Fixed `MastraGateway` with a `customFetch` failing with "Invalid API key format" for Mastra Gateway organization keys (`msk-gateway-...` and `mskv2_...`). The gateway that serves these keys reads the key only from `Authorization` and cannot forward a provider sign-in, so model calls now send the key in `Authorization` to the chat endpoint. Project keys (`msk_...`) still pass the provider sign-in through `customFetch` as before.
