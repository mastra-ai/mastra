# Phase 1 — Agent Builder Composio Gating Config (`editor.builder.registries.composio`)

> Parent RFC: [`../composio-research.md`](../composio-research.md) — see the "DISCOVERY (rev 3)" section at the top.
> Previous phase: —
> Next phase: [Phase 2 — Gated Catalog View](./phase-2-catalog.md)

## Goal

Add `editor.builder.registries.composio` as a **gating-only** config layer that references the existing `MastraEditorConfig.toolProviders.composio` provider. Validate the reference at boot. **Do not** instantiate any new Composio SDK client — that lives in `ComposioToolProvider`. Expose the gating data through `EditorAgentBuilder.getRegistries()`.

## Background

- Discovery in rev 3 of the parent RFC: `ToolProvider` infra (registry, `ComposioToolProvider`, SDK accessor, catalog routes, runtime resolver) already exists.
- The remaining gap for Agent Builder EE is *gating*: which toolkits/tools may an Agent Builder author see, and what platform user id is used for the runtime session.
- Parent RFC sections to re-read:
  - "DISCOVERY (rev 3): existing infrastructure"
  - "CONFIG MODEL (v1 — in code, under `editor.builder`)"
  - "USER IDS — same or different across phases"
- Inherited blockers: none.

## Scope

### Core types
- `packages/core/src/agent-builder/ee/types.ts` — extend `AgentBuilderOptions.registries` with `composio?: ComposioRegistryConfig`. Define `ComposioRegistryConfig`:
  ```ts
  export interface ComposioRegistryConfig {
    enabled: boolean;
    /** Id under `MastraEditorConfig.toolProviders`. Default: 'composio'. */
    providerId?: string;
    /** Shared Composio user id used for v1 platform-auth runs and connect-link initiates. */
    platformUserId: string;
    /** Toolkit slugs the Agent Builder may surface to authors. Empty array = none. */
    allowedToolkits: string[];
    /** Optional per-toolkit tool-slug restriction. Missing entry = all tools in that toolkit allowed. */
    allowedTools?: Record<string, string[]>;
    /** Optional per-toolkit custom auth-config id (ac_xxx). v1: rarely used. */
    authConfigs?: Record<string, string>;
  }
  ```
- `packages/core/src/agent-builder/ee/index.ts` — export `ComposioRegistryConfig`.

### Editor — gating module
- `packages/editor/src/ee/integrations/composio/validate.ts` — `validateComposioRegistry(config, toolProviders): ValidatedComposioRegistry`. Pure function. Returns a normalized object (with `providerId` defaulted to `'composio'`) or throws.
- `packages/editor/src/ee/integrations/composio/index.ts` — barrel: re-export validator + types.

### EditorAgentBuilder wiring
- `packages/editor/src/ee/agent-builder.ts`:
  - Accept an optional `toolProviders` map in the constructor (passed from `MastraEditor.resolveBuilder`). Keeps existing API compatible.
  - In the constructor, after model/browser validation, call `validateComposioRegistry` when `options.registries?.composio` is present. Cache the resolved value on the instance.
  - Surface via `getRegistries()` (already exists) — `composio` block in the returned object is the normalized shape, not the raw input.
- `packages/editor/src/index.ts` (`MastraEditor.resolveBuilder`) — pass the registered `toolProviders` map into the `EditorAgentBuilder` constructor so the validator can check the reference.

### Settings exposure (defensive minimum)
- Phase 2 owns the full public-settings response. Phase 1 only needs to **not** leak `platformUserId` or `authConfigs`. Add a TODO in `EditorAgentBuilder.getRegistries()`'s callsite if necessary — no behavior change.

### Tests
- `packages/editor/src/ee/integrations/composio/validate.test.ts` — covers:
  - missing `platformUserId` → throws
  - empty `allowedToolkits` → throws (explicit lockdown belongs to `enabled: false`)
  - `allowedTools` references a toolkit not in `allowedToolkits` → throws
  - referenced `providerId` not in `toolProviders` map → throws with actionable message
  - `enabled: false` short-circuits validation and returns a "disabled" sentinel
  - valid config returns normalized shape with `providerId` default applied
- `packages/editor/src/ee/agent-builder.test.ts` — extend:
  - constructor throws on invalid Composio config
  - constructor succeeds when registry absent
  - `getRegistries().composio` returns the **normalized** shape
- `packages/core/src/agent-builder/ee/types.test-d.ts` (or equivalent) — `ComposioRegistryConfig` compiles in the expected shape.

**Explicitly NOT touched**:
- `ComposioToolProvider` source — not edited; SDK accessor stays as-is.
- `packages/editor/package.json` deps — `@composio/core` / `@composio/mastra` already present.
- API routes, DB tables, UI components, runtime resolver.

## Acceptance truths

- [ ] `AgentBuilderOptions.registries.composio` accepts the new shape; TS compile passes in `packages/core`.
- [ ] `validateComposioRegistry` throws a clear, actionable error for every documented failure mode.
- [ ] When `registries.composio.enabled === false`, validator returns a sentinel ("disabled") without throwing.
- [ ] Validator never instantiates `Composio` or touches the network.
- [ ] `EditorAgentBuilder` constructor:
  - throws on invalid Composio config
  - no-ops when `registries.composio` absent
  - exposes the normalized shape via `getRegistries().composio`
- [ ] No new files import `@composio/core` or `@composio/mastra` (search assertion in test or grep).
- [ ] Existing `ComposioToolProvider` tests still pass.
- [ ] No edit to `packages/editor/src/providers/composio.ts`.

## Verification step

```
pnpm --filter ./packages/core check
pnpm build:core
pnpm test:core -- agent-builder/ee
pnpm --filter ./packages/editor typecheck
pnpm --filter ./packages/editor test -- composio
```

All must pass. Smoke: boot a Mastra project with `editor.builder.registries.composio` referencing an existing `toolProviders.composio` — server starts. Reference a non-existent `providerId` → server exits with the validation error.

## Handoff to next phase

- **Canonical types**: `ComposioRegistryConfig` in `packages/core/src/agent-builder/ee/types.ts`.
- **Canonical validator**: `validateComposioRegistry` in `packages/editor/src/ee/integrations/composio/validate.ts`. Phase 2 imports this for catalog gating.
- **Reference target**: `editor.builder.registries.composio.providerId` (default `'composio'`) → looked up against `MastraEditorConfig.toolProviders`. Do not duplicate the SDK client.
- **`getRegistries().composio`**: returns the normalized shape; safe to read in Phase 2 catalog route. Phase 2 still must NOT include `platformUserId` or `authConfigs` in any public response.
- **Backlog**: hot-reload of registry config (deferred); per-workspace overrides (deferred).
