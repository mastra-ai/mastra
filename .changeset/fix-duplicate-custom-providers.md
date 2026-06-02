---
"@mastra/server": patch
---

Fix custom providers appearing twice in Studio's provider selector.

In dev mode, `GatewayRegistry` registers custom gateways so `PROVIDER_REGISTRY` already contains them with prefixed keys (e.g. `"melioffice/genai"`). The `/agents/providers` handler then called `gateway.fetchProviders()` again and re-added them, but the live call returns raw unprefixed keys (e.g. `"genai"`) which after prefixing produce the same key — however in some cases the keys differed, causing both entries to appear in the UI.

The fix skips adding a provider from the live `fetchProviders()` call if it is already present in `allProviders` from `PROVIDER_REGISTRY`.
