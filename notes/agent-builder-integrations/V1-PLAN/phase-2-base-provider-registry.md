# Phase 2 — `BaseToolIntegration` + typed registry (Option B+ compat)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 1 — Provider interface + types](./phase-1-provider-interface.md)
> Next phase: [Phase 3 — Composio adapter](./phase-3-composio-adapter.md)

## Goal

`BaseToolIntegration` is the abstract class adapters extend; allowlist + glob filtering is implemented once. `MastraEditor` becomes generic over a flat array of providers and exposes typed accessors.

Phase 2 ships **Option B+ backwards compatibility**: existing consumers (Record-shaped `toolProviders`, `getToolProvider(id)` returning `undefined` on miss, `getToolProviders()` plural) keep working. New consumers opt into the array shape and the throwing accessor. All compat surfaces are marked `@deprecated` and removed in Phase 10.

## Background

- **Why this phase is ordered here**: every adapter (starting with Composio in Phase 3) extends `BaseToolIntegration`. Registry shape lands here so Phase 5's server handlers and Phase 6's UI both consume the same `MastraEditor` config.
- Spec sections to re-read:
  - ARCHITECTURE §4 "BaseToolIntegration"
  - ARCHITECTURE §5 "Registry" (esp. §5.2 generic array, §5.3 invariants)
  - ARCHITECTURE §14 "Backwards compatibility window" (added by this phase)
- Inherited blockers / constraints:
  - No wrapper-style provider (no `FilteredToolProvider`). Filtering is baked into `BaseToolIntegration`.
  - `MastraEditor` lives in `@mastra/editor`, NOT `@mastra/core`. Only the interface/abstract base class lives in core.
  - Compat surfaces are removed in Phase 10 — every shim must be tagged with a `// PHASE-10-REMOVE` comment for grep-ability.

## Compat layer (Option B+) — summary

| Surface | Legacy behaviour | v1 behaviour | Notes |
|---|---|---|---|
| `MastraEditorConfig.toolProviders` shape | `Record<string, ToolProvider>` | `Record<string, ToolIntegration> \| readonly ToolIntegration[]` | Normalized to array internally. Record shape logs a deprecation warning once per process. |
| `ToolProvider` interface | own interface | `type ToolProvider = ToolIntegration` alias | `@deprecated`. Source-compatible for `implements ToolProvider`. |
| `getToolProvider(id)` | returns `undefined` on miss | returns `undefined` on miss (unchanged) | Kept for backwards compat. |
| `getToolProviderOrThrow(id)` | did not exist | throws `UnknownProviderError` | New, preferred. Type-narrows to the concrete subclass. |
| `getToolProviders()` | returned `Record` | returns `readonly ToolIntegration[]` | `@deprecated`. Signature returns array — call sites that iterated `Object.values` need a 1-line change. |

Two specific signature shifts inside the compat surface (acceptable because they were pre-GA):
1. `getToolProviders()` returns an array, not a `Record`. Callers using `Object.values` simplify; callers using key access must migrate now.
2. Constructor still accepts both shapes, but `ToolIntegration` is the only valid value type (no `ToolProvider` value-shape compat, since `ToolProvider` is a type alias).

## Scope

### Core (`packages/core`)

- `packages/core/src/tool-integration/base.ts` — new. `BaseToolIntegration` abstract class:
  - Constructor opts: `{ allowedToolServices?: string[]; allowedTools?: string[] }` (glob).
  - Implements `listToolServices` + `listTools` with filtering.
  - Declares abstract `fetchToolServices`, `fetchTools`, `resolveTools`, `authorize`, `getAuthStatus`, `getConnectionStatus`, `getHealth`, `capabilities`.
- `packages/core/src/tool-integration/errors.ts` — new. `DuplicateProviderError`, `UnknownProviderError`.
- `packages/core/src/tool-integration/index.ts` — re-export base + errors.
- `packages/core/src/tool-provider/types.ts` (legacy module):
  - Replace the standalone `ToolProvider` interface body with `/** @deprecated PHASE-10-REMOVE */ export type ToolProvider = ToolIntegration;`.
  - Keep the file path so existing `import { ToolProvider } from '@mastra/core/tool-provider'` still resolves.
- `packages/core/src/editor/types.ts` — `MastraEditorConfig` update:
  - Change `toolProviders?: Record<string, ToolProvider>` → `toolProviders?: Record<string, ToolIntegration> | readonly ToolIntegration[]`.
  - `IMastraEditor` interface:
    - Keep `getToolProvider(id: string): ToolIntegration | undefined` — undefined-on-miss preserved.
    - Add `getToolProviderOrThrow<TId extends string>(id: TId): ToolIntegration` — typed-narrowing.
    - Keep `getToolProviders(): readonly ToolIntegration[]` marked `@deprecated PHASE-10-REMOVE` (returns array, was Record).

### Editor (`packages/editor`)

- `packages/editor/src/index.ts` — rewrite `MastraEditor`:
  ```ts
  class MastraEditor<TProviders extends readonly ToolIntegration[] = readonly ToolIntegration[]> {
    constructor(opts: {
      /**
       * @deprecated PHASE-10-REMOVE — pass an array instead.
       *   toolProviders: [new ComposioToolIntegration({ ... })]
       */
      toolProviders?: TProviders | Record<string, ToolIntegration>;
      /* …existing fields… */
    });

    /** Returns undefined on miss. Prefer `getToolProviderOrThrow` for narrowed types. */
    getToolProvider(id: string): ToolIntegration | undefined;

    getToolProviderOrThrow<TId extends TProviders[number]['id']>(
      id: TId,
    ): Extract<TProviders[number], { id: TId }>;

    /** @deprecated PHASE-10-REMOVE — iterate `editor.toolProviders` directly. */
    getToolProviders(): readonly ToolIntegration[];
  }
  ```
  - **Normalization**: on construction, if `toolProviders` is a `Record`, emit a one-shot `console.warn` and convert to array preserving insertion order. The Record-key MUST match `value.id`; mismatch throws `DuplicateProviderError` (or a dedicated `ProviderIdMismatchError` — pick one, document it).
  - Validates after normalization: duplicate `id` throws `DuplicateProviderError(ids[])`.
  - Internal storage: keep as array; build a `Map<string, ToolIntegration>` once for O(1) lookup.
  - `getToolProvider(id)` returns `map.get(id)` (undefined on miss).
  - `getToolProviderOrThrow(id)` returns `map.get(id) ?? throw UnknownProviderError(id, knownIds)`.
- `packages/editor/src/namespaces/agent.ts` (line ~1075) — existing caller already uses `getToolProvider(id)`. Migrate the `if (!provider) { 404 }` branch to call `getToolProviderOrThrow` inside try/catch in Phase 5 routes; in Phase 2 keep the existing undefined branch (it stays correct under B+).

### Server (`packages/server`) — minimal touch

Phase 2 does NOT migrate the server route logic, but the type changes ripple. Because B+ preserves `getToolProvider`'s undefined return, **no server code needs to change in Phase 2**. The existing handlers compile as-is. Phase 5 will migrate routes to `getToolProviderOrThrow` for cleaner 404 mapping.

### Example app callsites (compat-friendly)

All three callsites already use the Record shape; under B+ they keep working untouched. Optionally migrate one as a demo (`examples/agent-builder/src/mastra/index.ts`) to validate the array path end-to-end:

- `examples/agent-builder/src/mastra/index.ts` — `toolProviders: { composio: new ComposioToolIntegration(...) }` → `toolProviders: [new ComposioToolIntegration(...)] as const`.
- Leave `packages/playground/e2e/kitchen-sink/src/mastra/index.ts` on the Record shape to exercise the deprecation warning in CI logs.

### Playground consumer (read-only)

- `packages/playground/src/domains/tool-providers/hooks/*.ts` calls `client.getToolProvider(...)` on `@mastra/client-js`. Client-side method is independent of the server-class rename — no change needed.

### Tests

- `packages/core/src/tool-integration/base.test.ts` — allowlist filter, glob filter (`Gmail.*`, `gmail.fetch_*`), empty allowlist returns everything, denied tool service short-circuits without SDK call.
- `packages/editor/src/editor-registry.test.ts`:
  - Construct with array shape — passes.
  - Construct with Record shape — passes, emits one-shot deprecation warning (assert via `vi.spyOn(console, 'warn')`).
  - Construct with Record shape where key !== value.id — throws.
  - Duplicate id at construction throws `DuplicateProviderError`.
  - `getToolProvider('composio')` returns the instance; `getToolProvider('unknown')` returns `undefined` (compat check).
  - `getToolProviderOrThrow('composio')` returns the typed instance (`FakeProvider`).
  - `getToolProviderOrThrow('unknown')` throws `UnknownProviderError` with known-ids list.
  - `getToolProviders()` returns an array (compat check).
  - Empty `toolProviders` is allowed (legal config; throw only on miss when using `OrThrow`).
  - Type-only: `expectTypeOf(editor.getToolProviderOrThrow('composio')).toEqualTypeOf<FakeComposioProvider>()`.

**Explicitly NOT touched**: no real adapter implementation (Phase 3), no server route migration to `getToolProviderOrThrow` (Phase 5), no storage shape changes (Phase 7), no UI (Phase 6).

## Acceptance truths

- [ ] A `FakeProvider extends BaseToolIntegration` passes filter tests without SDK calls.
- [ ] `MastraEditor` accepts both Record and array `toolProviders` shapes.
- [ ] Record shape emits exactly one `console.warn` per process.
- [ ] `MastraEditor` constructor throws `DuplicateProviderError` when two entries share `id`.
- [ ] `editor.getToolProvider('composio')` returns the instance; `editor.getToolProvider('unknown')` returns `undefined`.
- [ ] `editor.getToolProviderOrThrow('composio')` is typed as the concrete subclass at the callsite (compile-time check via `expectTypeOf`).
- [ ] `editor.getToolProviderOrThrow('unknown')` throws `UnknownProviderError` listing known ids.
- [ ] `editor.getToolProviders()` returns an array.
- [ ] Every compat shim carries a `PHASE-10-REMOVE` marker (`grep -r 'PHASE-10-REMOVE' packages/` reports them).
- [ ] `examples/agent-builder` builds with both shapes (manual flip during PR review).

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

All builds clean. `PHASE-10-REMOVE` grep returns the expected shim sites (constructor Record branch, `ToolProvider` type alias, `getToolProviders` plural, `@deprecated` jsdoc).

## Handoff to next phase

- `BaseToolIntegration` exists and Phase 3 (Composio adapter) can extend it.
- `MastraEditor` accepts both Record and array shapes; Phase 5 (server routes) can rely on `getToolProviderOrThrow` for 404 mapping.
- Phase 10 will delete: Record-shape constructor branch + warning, `ToolProvider` type alias, `getToolProviders` plural, every `@deprecated` jsdoc tagged `PHASE-10-REMOVE`.
