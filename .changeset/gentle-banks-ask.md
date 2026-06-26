---
'@mastra/core': minor
'mastracode': patch
---

Resolve all Harness models through gateways. The Harness now builds its available-models catalog, model auth status, mode agents, Observational Memory models, and subagents from the gateways you register, instead of the separate `resolveModel`, `customModelCatalogProvider`, and `modelAuthChecker` config hooks. Removed those three options from `HarnessConfig` (and the `ModelAuthChecker` type) — register a gateway via `gateways` instead.

`listAvailableModels()` and `getCurrentModelAuthStatus()` are now sourced entirely from gateways: model discovery comes from each gateway's `fetchProviders()` (a network call for gateways like models.dev and Netlify), and auth status is resolved through the same gateway chain the model router uses at run time (`resolveAuth()`, falling back to `getApiKey()`). There is no static provider-registry fallback — everything the model picker shows comes from a gateway.

The gateway-chain operations shared by `ModelRouterLanguageModel` and the Harness (gateway merging, model→gateway selection, auth resolution, provider/model listing) are now centralized in a new `GatewayManager` class exported from `@mastra/core`. Both consumers delegate to it, eliminating duplicated logic. `defaultGateways` is still re-exported from the same paths for backward compatibility.
