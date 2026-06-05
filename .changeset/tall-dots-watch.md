---
'@mastra/core': minor
'mastracode': patch
---

Added interface-first model gateways while keeping the existing `MastraModelGateway` base class backwards compatible.

Added `MastraModelGatewayInterface` for plain object/custom gateway implementations and optional gateway `resolveAuth` hooks.

Moved MastraCode gateway-routed OAuth model construction into a custom Mastra gateway so `ModelRouterLanguageModel` can route through gateway `resolveAuth` and provider-specific `resolveLanguageModel` behavior.
