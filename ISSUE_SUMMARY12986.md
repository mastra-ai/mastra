# Issue #12986: [BUG] The model is incorrect in studio ui

## Summary

When a user configures a custom gateway in their Mastra instance, the Studio UI's model/provider selector only shows the default providers from `PROVIDER_REGISTRY` (models.dev, netlify). Custom gateway providers are **not included** in the list. The expected behavior is that custom gateway providers should appear **alongside** the default providers.

## Root Cause Analysis

The `GET_PROVIDERS_ROUTE` handler in `packages/server/src/server/handlers/agents.ts` (line 1119-1147) is the endpoint that populates the Studio UI's model list. It has two problems:

1. **No access to `mastra` instance**: The handler signature is `async () => {}` — it doesn't receive the `mastra` instance, so it cannot discover custom gateways.

2. **Only reads static registry**: It iterates over `PROVIDER_REGISTRY` entries only. Custom gateways register their providers dynamically via `gateway.fetchProviders()`, but the endpoint never calls this — so custom gateway providers never appear.

### Data Flow (current, broken)

```
GET /agents/providers → iterates PROVIDER_REGISTRY (static, default gateways only)
                      → custom gateway providers are missing from the response
                      → Studio UI never shows custom models
```

### Key Files

- `packages/server/src/server/handlers/agents.ts:1119-1147` — The providers endpoint handler (needs fix)
- `packages/core/src/llm/model/provider-registry.ts` — `PROVIDER_REGISTRY` proxy + `GatewayRegistry` singleton
- `packages/core/src/llm/model/gateways/base.ts` — `ProviderConfig` interface with `gateway` field; `MastraModelGateway.fetchProviders()`
- `packages/core/src/mastra/index.ts:3082` — `listGateways()` returns custom gateways or undefined

## Proposed Fix

In the `GET_PROVIDERS_ROUTE` handler:

1. Accept the `mastra` instance (like other route handlers already do)
2. Start with all providers from `PROVIDER_REGISTRY` (default behavior preserved)
3. Check `mastra.listGateways()` — if custom gateways exist, call `fetchProviders()` on each one
4. Merge custom gateway providers into the provider list
5. Update `isProviderConnected()` to also check custom providers

### Note on PR #13001

The linked PR uses an inline dynamic import `await import('@mastra/core/llm/model/registry-generator')` to get `fetchProvidersFromGateways`. This is unnecessary — `fetchProvidersFromGateways` is not exported from any public subpath in `@mastra/core`'s package.json, so this import would fail at runtime. Instead, we can call `gateway.fetchProviders()` directly on each custom gateway (the method is on the base class).

## How to Reproduce in a Test

In the existing test file `packages/server/src/server/handlers/agents.test.ts`, add a test that:
1. Mocks `PROVIDER_REGISTRY` with default providers (gateway: "models.dev")
2. Passes a mock `mastra` instance with `listGateways()` returning a custom gateway that has a `fetchProviders()` method
3. Calls `GET_PROVIDERS_ROUTE.handler({ mastra })`
4. Asserts that BOTH the default AND custom gateway providers are returned
