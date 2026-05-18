# Phase 1 — Provider interface + types (`packages/core/src/tool-provider/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Next phase: [Phase 2 — BaseToolIntegration + registry](./phase-2-base-provider-registry.md)

## Goal

Land the **new** shared `tool-provider` contracts and storage shapes alongside the existing ones, so every subsequent phase has stable types to import. Nothing is deleted in this phase — the old `ToolProvider` / `StorageMCPClientToolsConfig` stay in tree until Phase 3 (Composio adapter rewrite) and Phase 10 (cleanup) tear them out.

This phase is intentionally **additive**. The PR must build the entire workspace cleanly with no shims.

> **Compat note**: Phase 2 introduces backwards-compatibility shims (Option B+) for `MastraEditorConfig.toolProviders`, the `ToolProvider` interface, and `MastraEditor.getToolProvider*` accessors. Phase 1 does NOT add any compat code — it only lands the new contracts side-by-side with the legacy ones. The `toolIntegrations` storage field added here coexists with the legacy `integrationTools` field; both are read at runtime until Phase 10 collapses them.

## Background

- **Why this phase is ordered here**: nothing else can be implemented without the shared types existing. We add — never replace — so Phase 1 is reviewable in isolation.
- **Why additive instead of replace**: deleting `ToolProvider` here would break both editor adapters (`composio.ts`, `arcade.ts`), `editor/namespaces/agent.ts`, integration tests, and server schemas in one commit. Phase 3 owns the Composio rewrite; Phase 10 owns the prototype deletion.
- Spec sections to re-read:
  - ARCHITECTURE §1 "Vocabulary"
  - ARCHITECTURE §3 "Core types"
  - ARCHITECTURE §6 "Storage on the agent"
  - ARCHITECTURE §3.8 "Schema evolution rules" — **additive-only**, no version field, Zod `.passthrough()`.
- Inherited blockers / constraints: none (first phase).

## Scope

### Core (`packages/core`)

**Add** the new contracts under `packages/core/src/tool-integration/`:

- `packages/core/src/tool-integration/tool-integration.ts` — new file. Exports:
  - `ToolIntegration` interface (§3.1)
  - `ToolIntegrationCapabilities` type (§3.2)
  - `ResolveToolsOpts`, `AuthorizeOpts` (§3.3)
  - `Connection`, `ToolIntegrationConfig`, `ToolIntegrations` (§3.4–3.6)
  - `ToolService`, `ToolDescriptor`, `ToolIntegrationHealth` types
- `packages/core/src/tool-integration/index.ts` — re-export everything above. Legacy `packages/core/src/tool-provider/` is untouched.
- `packages/core/src/storage/types.ts`:
  - Add **new** field `toolIntegrations?: Record<string, ToolIntegrationConfig>` on `StorageStoredAgent` (final-name TBD, kept distinct from the existing `integrationTools` until Phase 10 swaps them).
  - **Do not** touch `StorageMCPClientToolsConfig` or the existing `integrationTools` / `mcpClients` fields.

> Naming note: ARCHITECTURE §3.6 calls the field `integrationTools`. Phase 1 cannot reuse that name because the prototype already uses it for the legacy shape on the same interface. We provisionally introduce the new shape under the **new** key `toolIntegrations` to keep both shapes live during the migration. Phase 10 renames `toolIntegrations → integrationTools` and drops the legacy field. Document this in the new file's JSDoc.

### Server (`packages/server`)

**Add** the new schema module without touching the existing `mcpClientToolsConfigSchema` callsites:

- `packages/server/src/server/schemas/tool-integrations.ts` — new file. Exports:
  - `connectionSchema` (Zod) — required `label` (`min(1).max(32)`, regex `[A-Za-z0-9 _-]+`), required `toolService`, required `kind`, `.passthrough()`.
  - `providerConfigSchema` — `tools` map + `connections` map. `superRefine` enforces case-insensitive unique non-empty `label` per `connections[toolService]`. `.passthrough()`.
  - `toolIntegrationsSchema` — `z.record(z.string(), providerConfigSchema)`.
- `packages/server/src/server/schemas/stored-agents.ts` and `agent-versions.ts`:
  - **Add** an optional `toolIntegrations: conditionalFieldSchema(toolIntegrationsSchema).optional()` field next to the existing `integrationTools` / `mcpClients` entries.
  - Leave the existing schemas untouched.

### Client SDK (`client-sdks/client-js`)

- `client-sdks/client-js/src/types.ts` — mirror the new types: `ToolIntegrations`, `ToolIntegrationConfig`, `Connection` (under the V2 names if there's a collision). Add the new `toolIntegrations?` field to the stored-agent type next to the existing `integrationTools`.

### Tests

- `packages/core/src/tool-integration/tool-integration.test-d.ts` — type-only `expectTypeOf` assertions covering:
  - `ToolIntegration` shape
  - `Connection.label: string` (not optional)
  - `ToolIntegrationConfig.connections` is `Record<string, Connection[]>`
  - `ToolIntegrations` is `Record<string, ToolIntegrationConfig>`
- `packages/server/src/server/schemas/tool-integrations.test.ts`:
  - rejects empty `label`
  - rejects `label.length > 32`
  - rejects `label` failing regex
  - rejects two connections on the same `toolService` sharing a case-insensitive `label`
  - accepts two connections with the same label on **different** `toolService`s
  - `.passthrough()` round-trips an unknown sibling field on a `Connection`
  - `.passthrough()` round-trips an unknown sibling field on a `ToolIntegrationConfig`

**Explicitly NOT touched:**

- No deletion of `ToolProvider`, `ToolProviderInfo`, `ToolProviderToolkit`, `ToolProviderToolInfo`, `ResolveToolProviderToolsOptions`.
- No deletion of `StorageMCPClientToolsConfig`, `mcpClientToolsConfigSchema`, the existing `integrationTools` / `mcpClients` storage fields.
- No provider adapters (`composio.ts`, `arcade.ts`) modified.
- No `MastraEditor` changes.
- No server routes, no UI, no `agentBuilderTool`, no mappers.

## Acceptance truths

- [ ] `packages/core/src/tool-integration/index.ts` exports the new `ToolIntegration`, `Connection`, `ToolIntegrationConfig`, `ToolIntegrations`, `ToolIntegrationCapabilities`, `ResolveToolsOpts`, `AuthorizeOpts`, `ToolService`, `ToolDescriptor`, `ToolIntegrationHealth`. Legacy `ToolProvider*` names remain at `packages/core/src/tool-provider/index.ts`.
- [ ] `StorageStoredAgent` carries optional `toolIntegrations?: Record<string, ToolIntegrationConfig>` in addition to the existing fields.
- [ ] `toolIntegrationsSchema.safeParse` rejects two connections sharing a case-insensitive label on the same `toolService` and reports the violating `toolService` in the issue path.
- [ ] `toolIntegrationsSchema.safeParse` preserves an unknown sibling field on a `Connection` (`.passthrough()` round-trip).
- [ ] `client-sdks/client-js` re-exports the same new types — type-level identity verified by `expectTypeOf<Connection>().toEqualTypeOf<...>()` in the client-js types test file.
- [ ] `pnpm build` succeeds across the entire workspace (no shims, no skipped packages).
- [ ] `grep -r 'toolIntegrations'` matches only the additive sites listed in this phase (core types, storage type, server schema, client-js type, tests). No editor / playground / mapper hits.

## Verification step

```bash
pnpm --filter ./packages/core build
pnpm --filter ./packages/server build
pnpm --filter ./client-sdks/client-js build
pnpm --filter ./packages/editor build       # must still pass — additive change
pnpm --filter ./packages/core test tool-integration
pnpm --filter ./packages/server test tool-integrations
```

All must pass. Workspace-wide `pnpm build` is the strongest signal — it proves the additive contract didn't break any existing code path.

## Handoff to next phase

- New types live at `@mastra/core/tool-integration` alongside the legacy ones.
- New storage field is `storedAgent.toolIntegrations` (renamed to `integrationTools` in Phase 10).
- New server schema module is `packages/server/src/server/schemas/tool-integrations.ts`.
- Phase 2 picks up `BaseToolIntegration` and the typed `MastraEditor` registry next to these types. Phase 3 rewrites Composio to the new interface and starts reading/writing `toolIntegrations`. Phase 10 removes the legacy types and renames `toolIntegrations → integrationTools`.
