# Phase 1 — Provider interface + types (`packages/core/src/tool-provider/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Next phase: [Phase 2 — BaseIntegrationProvider + registry](./phase-2-base-provider-registry.md)

## Goal

The shared `tool-provider` module exists with `IntegrationProvider`, `ProviderCapabilities`, `Connection`, `ProviderConfig`, and friends. Storage and server Zod schemas use the new `integrationTools` shape; the old `StorageMCPClientToolsConfig` is gone. No runtime, no adapter — just the contract.

## Background

- **Why this phase is ordered here**: nothing else compiles without the shared types. Replaces the prototype's `ToolProvider` interface in-place at the same module path (`@mastra/core/tool-provider`).
- Spec sections to re-read:
  - ARCHITECTURE §1 "Vocabulary"
  - ARCHITECTURE §3 "Core types"
  - ARCHITECTURE §6 "Storage on the agent"
- Inherited blockers / constraints: none (first phase). Schema is **additive-only**, Zod `.passthrough()`.

## Scope

### Core
- `packages/core/src/tool-provider/types.ts` — rewrite. Export `IntegrationProvider`, `ProviderCapabilities`, `Connection`, `ProviderConfig`, `ResolveToolsOpts`, `AuthorizeOpts`, `ToolService`, `ToolDescriptor`, `ProviderHealth`. Delete old `ToolProvider`, `ToolProviderInfo`, `ToolProviderToolkit`, `ToolProviderToolInfo`, `ResolveToolProviderToolsOptions`.
- `packages/core/src/tool-provider/index.ts` — re-exports.
- `packages/core/src/storage/types.ts` — add `integrationTools?: Record<string, ProviderConfig>` to `StorageStoredAgent`. Delete `StorageMCPClientToolsConfig`.

### Server
- `packages/server/src/server/schemas/integration-tools.ts` — new. Zod schemas for `Connection`, `ProviderConfig`. `superRefine` enforces case-insensitive unique non-empty `label` per `connections[toolService]`. Uses `.passthrough()`.
- `packages/server/src/server/schemas/stored-agents.ts` — replace `mcpClientToolsConfigSchema` import with `integrationToolsSchema`.
- `packages/server/src/server/schemas/agent-versions.ts` — same.

### Client SDK
- `client-sdks/client-js/src/types.ts` — mirror `IntegrationTools`, `ProviderConfig`, `Connection`.

### Tests
- `packages/core/src/tool-provider/types.test.ts` — type-only `expectTypeOf` assertions.
- `packages/server/src/server/schemas/integration-tools.test.ts` — label validation (required, length, regex, case-insensitive uniqueness), `.passthrough()` round-trip preserves unknown fields.

**Explicitly NOT touched**: no provider adapters, no `MastraEditor` changes, no server routes, no UI, no `agentBuilderTool`.

## Acceptance truths

- [ ] `packages/core/src/tool-provider/types.ts` exports `IntegrationProvider` and no longer exports `ToolProvider`.
- [ ] `StorageStoredAgent.integrationTools` is typed as `Record<string, ProviderConfig> | undefined`.
- [ ] `integrationToolsSchema.safeParse` rejects two connections sharing a case-insensitive label on the same `toolService`.
- [ ] `integrationToolsSchema.safeParse` preserves an unknown sibling field on a `Connection`.
- [ ] `client-sdks/client-js` re-exports the same shape (single source of truth verified by type assertion).
- [ ] Repo-wide search for `StorageMCPClientToolsConfig` returns zero hits.

## Verification step

```
pnpm --filter ./packages/core build
pnpm --filter ./packages/server build
pnpm --filter ./client-sdks/client-js build
pnpm --filter ./packages/core test types
pnpm --filter ./packages/server test integration-tools
```

All must pass. Type tests + schema tests green.

## Handoff to next phase

- New module: `packages/core/src/tool-provider/` (types only).
- New schema module: `packages/server/src/server/schemas/integration-tools.ts`.
- `StorageStoredAgent.integrationTools` is the canonical agent storage field for integrations — Phase 2's `MastraEditor` reads it, Phases 4-7 produce/consume it.
- Phase 2 picks up by adding `base.ts` and the typed registry next to these types.
