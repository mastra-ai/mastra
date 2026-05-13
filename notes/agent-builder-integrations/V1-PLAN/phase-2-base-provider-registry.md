# Phase 2 — `BaseIntegrationProvider` + typed registry (`packages/core/src/tool-provider/`, `packages/core/src/editor/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 1 — Provider interface + types](./phase-1-provider-interface.md)
> Next phase: [Phase 3 — Composio adapter](./phase-3-composio-adapter.md)

## Goal

`BaseIntegrationProvider` is the abstract class adapters extend; allowlist + glob filtering is implemented once. `MastraEditor` is generic over a flat array of providers and exposes `getToolProvider(id)` that narrows to the concrete adapter type and throws on miss.

## Background

- **Why this phase is ordered here**: every adapter (starting with Composio in Phase 3) extends `BaseIntegrationProvider`. Registry shape lands here so Phase 5's server handlers and Phase 6's UI both consume the same `MastraEditor` config.
- Spec sections to re-read:
  - ARCHITECTURE §4 "BaseIntegrationProvider"
  - ARCHITECTURE §5 "Registry" (esp. §5.2 generic array)
- Inherited blockers / constraints: no `FilteredToolProvider` wrapper. No `getToolProvider` overload that returns `undefined`.

## Scope

### Core
- `packages/core/src/tool-provider/base.ts` — new. `BaseIntegrationProvider` abstract class:
  - Constructor opts: `{ allowedToolServices?: string[]; allowedTools?: string[] }` (glob).
  - Implements `listToolServices` + `listTools` with filtering.
  - Declares abstract `fetchToolServices`, `fetchTools`, `resolveTools`, `authorize`, `getAuthStatus`, `getConnectionStatus`, `getHealth`, `capabilities`.
- `packages/core/src/tool-provider/errors.ts` — new. `DuplicateProviderError`, `UnknownProviderError`.
- `packages/core/src/editor/types.ts` — `MastraEditorConfig` accepts `toolProviders: readonly IntegrationProvider[]`. Drop `registries.composio.*`.
- `packages/core/src/editor/index.ts` — rewrite `MastraEditor`:
  ```ts
  class MastraEditor<TProviders extends readonly IntegrationProvider[]> {
    constructor(opts: { toolProviders: TProviders });
    getToolProvider<TId extends TProviders[number]['id']>(
      id: TId,
    ): Extract<TProviders[number], { id: TId }>;
  }
  ```
  - Validates at construction: throws `DuplicateProviderError`.
  - `getToolProvider` throws `UnknownProviderError(id, knownIds)` on miss.

### Tests
- `packages/core/src/tool-provider/base.test.ts` — allowlist filter, glob filter (`Gmail.*`, `gmail.fetch_*`), empty allowlist returns everything, denied tool service short-circuits without SDK call.
- `packages/core/src/editor/editor-registry.test.ts`:
  - Duplicate id at construction throws `DuplicateProviderError`.
  - `getToolProvider('composio')` returns the typed instance (`FakeProvider`).
  - `getToolProvider('unknown')` throws `UnknownProviderError` with known-ids list.
  - Type-only: `expectTypeOf(editor.getToolProvider('composio')).toEqualTypeOf<FakeComposioProvider>()`.

**Explicitly NOT touched**: no real adapter implementation, no server routes, no storage shape changes, no UI.

## Acceptance truths

- [ ] A `FakeProvider extends BaseIntegrationProvider` passes filter tests without SDK calls.
- [ ] `MastraEditor` constructor throws `DuplicateProviderError` when two entries share `id`.
- [ ] `editor.getToolProvider('composio')` is typed as the concrete subclass at the callsite (compile-time check via `expectTypeOf`).
- [ ] `editor.getToolProvider('unknown')` throws `UnknownProviderError` listing known ids.
- [ ] Repo-wide search for `FilteredToolProvider` returns zero hits.
- [ ] Repo-wide search for `: ToolProvider | undefined` returns zero hits in core.

## Verification step

```
pnpm --filter ./packages/core build
pnpm --filter ./packages/core test base
pnpm --filter ./packages/core test editor-registry
```

All must pass. Filter + registry tests green; type tests compile.

## Handoff to next phase

- Canonical base class: `packages/core/src/tool-provider/base.ts`. Phase 3's `ComposioToolProvider extends BaseIntegrationProvider`.
- Canonical registry: `MastraEditor` in `packages/core/src/editor/index.ts`. Server handlers (Phase 5) call `editor.getToolProvider(id)` for dispatch.
- Error shapes finalized: `DuplicateProviderError`, `UnknownProviderError`. Server routes will translate `UnknownProviderError` → 404.
