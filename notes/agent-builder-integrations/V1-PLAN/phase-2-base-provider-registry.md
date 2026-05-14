# Phase 2 — `BaseToolIntegration` + parallel typed registry

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 1 — Provider interface + types](./phase-1-provider-interface.md)
> Next phase: [Phase 3 — Composio adapter](./phase-3-composio-adapter.md)

## Goal

Ship the abstract base class adapters extend and a typed registry surface that lives **alongside** the legacy `ToolProvider` surface — not in place of it. After Phase 2:

- Adapters can extend `BaseToolIntegration` (no real adapter ships in Phase 2; Phase 3 brings the first).
- `MastraEditor` exposes a typed `getToolIntegrationOrThrow<TId>(id)` accessor that narrows to the concrete subclass via a generic over the registered array.
- The existing `ToolProvider` interface, `MastraEditor.getToolProvider*`, and the example app's `toolProviders: { composio: new ComposioToolProvider(...) }` config all keep working untouched. They are marked `@deprecated PHASE-10-REMOVE`.

## Why a separate surface (not a type alias)

The Phase 1 plan called for replacing the legacy `ToolProvider` interface body with `type ToolProvider = ToolIntegration`. That doesn't work on this branch: the two interfaces are structurally incompatible.

| Legacy `ToolProvider` | New `ToolIntegration` |
|---|---|
| `info: { id, name, description? }` | `id`, `displayName`, `capabilities` |
| `listToolkits()` | `listToolServices()` |
| `listTools(opts)` | `listTools(toolService)` |
| `resolveTools(slugs, configs, opts)` | `resolveTools({ toolSlugs, toolMeta, connectionId, requestContext })` |
| `getToolSchema(slug)` | — (UI fetches descriptors instead) |
| — | `authorize`, `getAuthStatus`, `getConnectionStatus`, `getHealth` |

A naive alias breaks `editor/src/providers/composio.ts`, `editor/src/providers/arcade.ts`, `editor/src/namespaces/agent.ts` (calls `provider.resolveTools(slugs, configs, opts)`), `server/src/server/handlers/tool-providers.ts` (calls `provider.listToolkits`, `provider.getToolSchema`), and the legacy mock in `editor-integration-tools.test.ts`.

The clean cut-over path therefore runs **per surface**, not as a single type alias:

- **Phase 2** (this phase): legacy surface untouched but `@deprecated`. New surface lives next to it.
- **Phase 3**: rewrite Composio adapter against `BaseToolIntegration` and register on the new surface.
- **Phase 5**: introduce `/tool-integrations/*` REST routes that consume the new surface.
- **Phase 10**: delete the legacy `ToolProvider` interface, `MastraEditor.getToolProvider*`, `/tool-providers/*` routes, the legacy hydration code path in `agent.ts`, and the legacy storage shape — all in one PR.

Every shim or deprecation tag added in Phase 2 carries a `// PHASE-10-REMOVE` comment for grep-ability.

## Background

- Spec sections to re-read:
  - ARCHITECTURE §4 "BaseToolIntegration"
  - ARCHITECTURE §5 "Registry"
  - ARCHITECTURE §14 "Backwards compatibility window" (added by Phase 2)
- Inherited blockers / constraints:
  - No wrapper-style provider (no `FilteredToolProvider`). Filtering is baked into `BaseToolIntegration`.
  - `MastraEditor` lives in `@mastra/editor`, NOT `@mastra/core`. Only the interface / abstract base class live in core.
  - Phase 2 stays additive — no real adapter, no server routes, no UI, no storage changes.

## Compat surface summary

| Surface | Legacy behaviour | After Phase 2 | Removal |
|---|---|---|---|
| `ToolProvider` interface (core/tool-provider/types.ts) | full interface body | unchanged, JSDoc `@deprecated PHASE-10-REMOVE` | Phase 10 |
| `MastraEditorConfig.toolProviders: Record<string, ToolProvider>` | required passthrough | unchanged, `@deprecated PHASE-10-REMOVE` | Phase 10 |
| `MastraEditor.getToolProvider(id)` | returns `ToolProvider \| undefined` | unchanged, `@deprecated PHASE-10-REMOVE` | Phase 10 |
| `MastraEditor.getToolProviders()` | returns `Record<string, ToolProvider>` | unchanged, `@deprecated PHASE-10-REMOVE` | Phase 10 |
| `MastraEditorConfig.toolIntegrations: readonly ToolIntegration[]` | did not exist | new field | — |
| `MastraEditor.getToolIntegration(id)` | did not exist | new, returns `ToolIntegration \| undefined` | — |
| `MastraEditor.getToolIntegrationOrThrow<TId>(id)` | did not exist | new, typed-narrowing, throws `UnknownIntegrationError` | — |
| `MastraEditor.getToolIntegrations()` | did not exist | new, returns `readonly ToolIntegration[]` | — |
| `BaseToolIntegration` abstract class | did not exist | new, in `@mastra/core/tool-integration` | — |

Old and new registries are **independent**: a `MastraEditor` instance can have both `toolProviders: { composio: legacy }` and `toolIntegrations: [newIntegration]` populated at the same time during the migration window. Phase 3 swaps the example app over to the new shape; Phase 10 deletes the old shape.

## Scope

### Core (`packages/core`)

- `packages/core/src/tool-integration/errors.ts` — new.
  - `DuplicateIntegrationError(ids: string[])` — thrown when two registered `ToolIntegration`s share an `id`.
  - `UnknownIntegrationError(id: string, knownIds: readonly string[])` — thrown by `getToolIntegrationOrThrow`.
- `packages/core/src/tool-integration/base.ts` — new. `BaseToolIntegration` abstract class:
  - Constructor opts: `{ allowedToolServices?: readonly string[]; allowedTools?: readonly string[] }` — glob-friendly strings (Phase 2 supports exact-match + `*` suffix; full glob can land in v1.5).
  - Implements `listToolServices`, `listTools(toolService)`:
    - Calls abstract `fetchToolServices()` / `fetchTools(toolService)`.
    - Filters by allowlists (case-sensitive equality, plus `*` prefix wildcard like `gmail.*`).
    - Short-circuits with `[]` when the requested `toolService` is denied.
  - Provides default `capabilities` getter that subclasses can override.
  - Declares abstract: `fetchToolServices()`, `fetchTools(toolService)`, `resolveTools`, `authorize`, `getAuthStatus`, `getConnectionStatus`, `getHealth`, and the `id` / `displayName` getters.
- `packages/core/src/tool-integration/index.ts` — re-export `BaseToolIntegration`, both new error classes.
- `packages/core/src/tool-provider/types.ts`:
  - Add `@deprecated PHASE-10-REMOVE` JSDoc on `ToolProvider`, `ToolProviderInfo`, `ToolProviderToolkit`, `ToolProviderToolInfo`, `ToolProviderListResult`, `ListToolProviderToolsOptions`, `ResolveToolProviderToolsOptions`.
  - **Do not change the bodies.**
- `packages/core/src/editor/types.ts` (`MastraEditorConfig` + `IMastraEditor`):
  - Add `toolIntegrations?: readonly ToolIntegration[]` to `MastraEditorConfig` (alongside the existing `toolProviders` field).
  - On `IMastraEditor`:
    - Tag `getToolProvider`, `getToolProviders` with `@deprecated PHASE-10-REMOVE` JSDoc.
    - Add `getToolIntegration(id: string): ToolIntegration | undefined`.
    - Add `getToolIntegrationOrThrow(id: string): ToolIntegration` (the runtime signature; the **typed-narrowing generic lives on the concrete `MastraEditor` class**, not on the interface).
    - Add `getToolIntegrations(): readonly ToolIntegration[]`.

### Editor (`packages/editor`)

- `packages/editor/src/index.ts` — `MastraEditor`:
  ```ts
  class MastraEditor<TIntegrations extends readonly ToolIntegration[] = readonly ToolIntegration[]> implements IMastraEditor {
    private __toolProviders: Record<string, ToolProvider>; // legacy — PHASE-10-REMOVE
    private __toolIntegrations: readonly ToolIntegration[];
    private __toolIntegrationById: Map<string, ToolIntegration>;

    constructor(config?: MastraEditorConfig & { toolIntegrations?: TIntegrations });

    /** @deprecated PHASE-10-REMOVE */
    getToolProvider(id: string): ToolProvider | undefined;
    /** @deprecated PHASE-10-REMOVE */
    getToolProviders(): Record<string, ToolProvider>;

    getToolIntegration(id: string): ToolIntegration | undefined;

    /**
     * Typed-narrowing accessor. The generic over `TIntegrations` lets TS
     * resolve the concrete subclass at the callsite.
     */
    getToolIntegrationOrThrow<TId extends TIntegrations[number]['id']>(
      id: TId,
    ): Extract<TIntegrations[number], { id: TId }>;
    /** Wide overload used by IMastraEditor consumers. */
    getToolIntegrationOrThrow(id: string): ToolIntegration;

    getToolIntegrations(): readonly ToolIntegration[];
  }
  ```
  - Constructor normalises `config?.toolIntegrations` into an array + an `id → ToolIntegration` `Map`. Empty / undefined defaults to `[]`.
  - Validates: duplicate `id` throws `DuplicateIntegrationError`. Empty array is allowed.
  - `getToolIntegration` returns `map.get(id) ?? undefined`.
  - `getToolIntegrationOrThrow` returns `map.get(id) ?? throw new UnknownIntegrationError(id, knownIds)`.
  - Legacy fields and methods are kept verbatim with `@deprecated PHASE-10-REMOVE` comments.
- `packages/editor/src/namespaces/agent.ts` — **untouched in Phase 2**. The legacy `resolveStoredIntegrationTools` keeps reading `integrationTools` from storage and calling `editor.getToolProvider(id).resolveTools(slugs, configs, opts)`. Phase 4 introduces the new fan-out helper.

### Server (`packages/server`) — no changes

The existing `/tool-providers/*` handlers keep calling the legacy `editor.getToolProvider(id)`. They compile as-is. Phase 5 deletes them and replaces with `/tool-integrations/*`.

### Example app callsites — no changes

`examples/agent-builder/src/mastra/index.ts` still uses the legacy `toolProviders: { composio: new ComposioToolProvider(...) }` config. Phase 3 swaps the example over to `toolIntegrations: [new ComposioToolIntegration(...)] as const` when the new adapter lands.

### Tests

- `packages/core/src/tool-integration/base.test.ts`:
  - Subclass with `allowedToolServices: ['gmail', 'slack']`: `listToolServices` returns only those two.
  - Subclass with `allowedTools: ['gmail.fetch_*']`: `listTools('gmail')` filters to matching slugs.
  - Empty allowlists → everything passes through.
  - Denied tool service short-circuits `listTools` with `[]` and never invokes the abstract `fetchTools`.
  - `getHealth` default implementation returns `{ ok: true }` (or the subclass override is honoured).
- `packages/editor/src/editor-registry.test.ts`:
  - Construct with `toolIntegrations: [a, b]` — both registered.
  - `getToolIntegration('a')` returns `a`; `getToolIntegration('missing')` returns `undefined`.
  - `getToolIntegrationOrThrow('a')` returns the typed instance (`expectTypeOf` check).
  - `getToolIntegrationOrThrow('missing')` throws `UnknownIntegrationError` with known-ids list.
  - `getToolIntegrations()` returns the array in insertion order.
  - Duplicate `id` at construction throws `DuplicateIntegrationError`.
  - Empty / undefined `toolIntegrations` is allowed.
  - Legacy `getToolProvider` / `getToolProviders` still work alongside.
  - Type-only: `expectTypeOf(editor.getToolIntegrationOrThrow('composio')).toEqualTypeOf<FakeComposioIntegration>()` when `TIntegrations` is inferred.

**Explicitly NOT touched**: no real adapter implementation (Phase 3), no server route migration (Phase 5), no storage shape changes (Phase 7), no UI (Phase 6), no runtime fan-out helper (Phase 4).

## Acceptance truths

- [ ] A `FakeIntegration extends BaseToolIntegration` passes filter tests without SDK calls.
- [ ] `MastraEditor` accepts both legacy `toolProviders` and new `toolIntegrations` config fields simultaneously.
- [ ] `MastraEditor` constructor throws `DuplicateIntegrationError` when two `toolIntegrations` entries share `id`.
- [ ] `editor.getToolIntegration('composio')` returns the instance; `editor.getToolIntegration('unknown')` returns `undefined`.
- [ ] `editor.getToolIntegrationOrThrow('composio')` is typed as the concrete subclass at the callsite (compile-time check via `expectTypeOf`).
- [ ] `editor.getToolIntegrationOrThrow('unknown')` throws `UnknownIntegrationError` listing known ids.
- [ ] `editor.getToolIntegrations()` returns an array in insertion order.
- [ ] Legacy `editor.getToolProvider(...)` / `editor.getToolProviders()` continue to work; the JSDoc shows `@deprecated`.
- [ ] Every compat shim or deprecated symbol carries a `PHASE-10-REMOVE` marker (`grep -r 'PHASE-10-REMOVE' packages/core packages/editor` reports them).
- [ ] `examples/agent-builder` still builds without modification.

## Verification step

```
pnpm --filter ./packages/core build
pnpm --filter ./packages/core test tool-integration
pnpm --filter ./packages/editor build
pnpm --filter ./packages/editor test editor-registry
pnpm --filter ./packages/server build
pnpm --filter ./examples/agent-builder build
grep -r 'PHASE-10-REMOVE' packages/core packages/editor
```

All builds clean. `PHASE-10-REMOVE` grep returns the expected shim sites (legacy `ToolProvider*` types, legacy `getToolProvider*` methods, legacy `toolProviders` config field).

## Handoff to next phase

- `BaseToolIntegration` exists and Phase 3 (Composio adapter) can extend it.
- `MastraEditor` exposes both registries; Phase 3 swaps the example app from `toolProviders` to `toolIntegrations`.
- Phase 5 (server routes) can rely on `getToolIntegrationOrThrow` for 404 mapping on the new `/tool-integrations/*` routes.
- Phase 10 deletes everything tagged `PHASE-10-REMOVE`: legacy interface, legacy methods, legacy config field, legacy hydration branch, legacy server routes, legacy storage field.
