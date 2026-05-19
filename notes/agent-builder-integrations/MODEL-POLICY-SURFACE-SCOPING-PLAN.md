---
goal: model-policy-surface-scoping
status: ready
depends-on: caller-supplied-user-id-plan
estimated-loc: 400
estimated-commits: 7
---

# Model Policy Surface Scoping Plan

## Overview

Today `BuilderModelPolicy` is named and scoped as a builder concept but leaks into the CMS editor and the chat composer through a global `useBuilderModelPolicy()` hook and a global server-side save enforcement. As a result, an admin who restricts models in the builder accidentally restricts the editor and composer too.

This plan introduces a **surface seam** for model policies. Each UI surface declares which policy slot it reads, and the server resolves the policy based on that surface. The editor surface ships with an inactive policy today; a future PR will add `editor.editorAgents.modelPolicy` as its real source.

## Locked Defaults

| Decision | Value |
|---|---|
| Surface enum | `'builder' \| 'editor'` |
| Default surface (no provider) | `'editor'` (unrestricted) |
| Composer behavior | inherits surrounding surface — builder preview reads builder, editor preview reads editor, standalone chat defaults to editor |
| Editor policy concept | first-class; **resolver returns `{ active: false }` for now** |
| Editor policy source (future) | `editor.editorAgents.modelPolicy` (separate PR) |
| Server save-path enforcement | **removed entirely**; UI gating only this release |
| Server GET policy route | `GET /editor/settings/model-policy?surface=builder\|editor` |
| Type rename | `BuilderModelPolicy` → `ModelPolicy`; old name kept as `@deprecated` alias |
| Hook rename | `useBuilderModelPolicy` → `useModelPolicy`; old name kept as `@deprecated` alias |
| Resolver rename | `resolveBuilderModelPolicy` → `resolveModelPolicy({ editor, surface })` |
| Deprecation horizon | aliases removed in vNext |

## Pre-flight

- Rebuild `@mastra/core` after Phase 1 so Phase 2 typechecks against the new `ModelPolicy` type.
- Rebuild `@mastra/client-js` after Phase 6 so playground sees regenerated route types.
- Phase 5 must run after Phase 3 (context exists) and Phase 4 (shared components migrated).

## Phases

### Phase 1 — Core types

**ID**: phase_1
**Touched files**:
- `packages/core/src/agent-builder/ee/types.ts`
- `packages/core/src/agent-builder/ee/policy.ts`
- `packages/core/src/agent-builder/ee/index.ts`
- `packages/core/src/agent-builder/ee/policy.test.ts`

**Subtasks**:
- [ ] `p1_rename_type` — Add `ModelPolicy` interface (verbatim shape); keep `BuilderModelPolicy` as `@deprecated` type alias.
- [ ] `p1_rename_helpers` — Add `isModelPolicyActive`; keep `isBuilderModelPolicyActive` as `@deprecated` alias re-export.
- [ ] `p1_export_surface_type` — Export `type ModelPolicySurface = 'builder' | 'editor'`.
- [ ] `p1_build_verify` — `pnpm --filter @mastra/core build && pnpm --filter @mastra/core test agent-builder/ee/policy`.

**Done when**:
- `ModelPolicy`, `ModelPolicySurface`, and `isModelPolicyActive` exported from `@mastra/core/agent-builder/ee`.
- `BuilderModelPolicy` and helpers still exported as deprecated aliases.
- All existing policy tests pass unchanged.

---

### Phase 2 — Server resolver + GET route

**ID**: phase_2
**Touched files**:
- `packages/server/src/server/utils/resolve-builder-model-policy.ts` → rename to `resolve-model-policy.ts`
- `packages/server/src/server/utils/resolve-builder-model-policy.test.ts` → rename
- `packages/server/src/server/handlers/stored-agents.ts`
- `packages/server/src/server/handlers/editor-builder.ts`
- `packages/server/src/server/schemas/editor-builder.ts` (if separate)

**Subtasks**:
- [ ] `p2_resolver` — Export `resolveModelPolicy({ editor, surface })`. For `surface === 'editor'`, return `{ active: false }`. For `surface === 'builder'`, return existing builder-policy resolution.
- [ ] `p2_resolver_alias` — Keep `resolveBuilderModelPolicy(editor)` as `@deprecated` wrapper calling `resolveModelPolicy({ editor, surface: 'builder' })`.
- [ ] `p2_remove_save_enforcement` — Delete the `resolveBuilderModelPolicy` + `assertModelAllowed` block from the stored-agents save handler. Document the removal in the handler with a one-line comment pointing to the new UI-gating model.
- [ ] `p2_get_route` — Update `GET /editor/builder/settings` to keep returning the builder policy unchanged (back-compat). Add a new `GET /editor/settings/model-policy?surface=...` returning the surface's policy.
- [ ] `p2_tests` — Add resolver tests: `surface: 'editor'` returns inactive regardless of `editor.builder.modelPolicy`; `surface: 'builder'` returns the configured policy. Add handler test: save with disallowed model now succeeds (UI gating removed).
- [ ] `p2_build_verify` — `pnpm --filter @mastra/server build && pnpm --filter @mastra/server test resolve-model-policy stored-agents editor-builder`.

**Done when**:
- New resolver name + alias both exported.
- New surface-aware GET route returns correct policy per surface.
- Save handler no longer enforces model allowlist; existing save tests updated accordingly.
- Server build + tests pass.

---

### Phase 3 — Playground context + hook

**ID**: phase_3
**Touched files**:
- `packages/playground/src/domains/llm/context/model-policy-context.tsx` (new)
- `packages/playground/src/domains/llm/hooks/use-model-policy.ts` (new)
- `packages/playground/src/domains/llm/index.ts`
- `packages/playground/src/domains/builder/hooks/use-builder-settings.ts`
- `packages/playground/src/domains/builder/index.ts`

**Subtasks**:
- [ ] `p3_context` — Create `ModelPolicyContext` with `INACTIVE_POLICY` default. Export `<ModelPolicyProvider surface>` that fetches the appropriate policy via the new GET route.
- [ ] `p3_hook` — `useModelPolicy()` reads context. Returns `{ active: false }` if no provider mounted.
- [ ] `p3_deprecate_old` — Mark `useBuilderModelPolicy` as `@deprecated`; keep it functional (still reads builder policy directly) for callers not yet migrated.
- [ ] `p3_tests` — Unit tests: provider with `surface='builder'` returns real policy; `surface='editor'` returns inactive; bare hook (no provider) returns inactive.
- [ ] `p3_build_verify` — `pnpm --filter @mastra/playground test domains/llm`.

**Done when**:
- New context, provider, and hook exported from `@/domains/llm`.
- Deprecated alias still works for in-flight code.
- Tests green.

---

### Phase 4 — Migrate shared LLM components

**ID**: phase_4
**Touched files**:
- `packages/playground/src/domains/llm/components/llm-providers.tsx`
- `packages/playground/src/domains/llm/components/llm-models.tsx`

**Subtasks**:
- [ ] `p4_providers` — Replace `useBuilderModelPolicy()` import with `useModelPolicy()`.
- [ ] `p4_models` — Replace `useBuilderModelPolicy()` import with `useModelPolicy()`.
- [ ] `p4_tests` — Render `<LLMProviders>` under `<ModelPolicyProvider surface="editor">` with a builder policy active in the test fixture; assert full provider list rendered.
- [ ] `p4_build_verify` — `pnpm --filter @mastra/playground test domains/llm`.

**Done when**:
- Shared components have zero references to any name starting with `Builder*`.
- Editor-surface render tests assert no filtering applied.

---

### Phase 5a — Wrap routes with provider

**ID**: phase_5a
**Touched files**:
- Agent builder route shell (TBD: `packages/playground/src/pages/builder/*` — locate during execution)
- CMS agent-edit route shell (`packages/playground/src/domains/agents/components/agent-cms-form-shell.tsx` or its parent route)

**Subtasks**:
- [ ] `p5a_locate_builder_shell` — Identify the builder route entry component and wrap children with `<ModelPolicyProvider surface="builder">`.
- [ ] `p5a_locate_editor_shell` — Identify the CMS agent-edit route entry and wrap with `<ModelPolicyProvider surface="editor">`.
- [ ] `p5a_smoke_test` — Manual: load builder route → DOM has provider; load editor route → DOM has provider.

**Done when**:
- Each surface has exactly one provider mount.
- Composer rendered in either preview inherits the correct surface.

---

### Phase 5b — Migrate remaining consumers

**ID**: phase_5b
**Touched files**:
- `packages/playground/src/domains/agents/components/agent-metadata/agent-metadata-model-switcher.tsx`
- `packages/playground/src/domains/agents/components/composer-model-switcher.tsx`
- `packages/playground/src/domains/agent-builder/components/agent-builder-edit/agent-configure-panel.tsx`
- `packages/playground/src/domains/agent-builder/hooks/use-agent-builder-allowed-models.ts`
- `packages/playground/src/domains/builder/hooks/use-builder-filtered-models.ts`

**Subtasks**:
- [ ] `p5b_metadata_switcher` — Swap to `useModelPolicy()`.
- [ ] `p5b_composer_switcher` — Swap to `useModelPolicy()`. Composer has no surface awareness; inherits.
- [ ] `p5b_configure_panel` — Swap to `useModelPolicy()`.
- [ ] `p5b_allowed_models_hook` — Swap to `useModelPolicy()`.
- [ ] `p5b_filtered_models_hook` — Swap to `useModelPolicy()`.
- [ ] `p5b_tests` — Update `agent-configure-panel.test.tsx` mock to mock `useModelPolicy`. Add new test: `<AgentMetadataModelSwitcher>` rendered under `<ModelPolicyProvider surface="editor">` with a builder policy active → all providers visible, no lock chip.
- [ ] `p5b_build_verify` — `pnpm --filter @mastra/playground test`.

**Done when**:
- No remaining import of `useBuilderModelPolicy` anywhere in playground source.
- Bug from the originating thread fixed: CMS editor + composer-in-editor show full model list under builder allowlist.
- Builder behavior preserved: only allowlisted providers visible, lock chip when `pickerVisible: false`.

---

### Phase 6 — Client SDK type rename

**ID**: phase_6
**Touched files**:
- `client-sdks/client-js/src/types.ts`
- `client-sdks/client-js/src/route-types.generated.ts`

**Subtasks**:
- [ ] `p6_alias` — Export `ModelPolicy` alongside `BuilderModelPolicy`; mark old as `@deprecated` via JSDoc.
- [ ] `p6_regen` — Run `pnpm --filter @mastra/client-js generate:route-types` to pick up the new `GET /editor/settings/model-policy` route.
- [ ] `p6_build_verify` — `pnpm --filter @mastra/client-js build && pnpm --filter @mastra/client-js test`.

**Done when**:
- Both type names exported.
- Regenerated route types include the new endpoint.
- Client-js tests pass.

---

### Phase 7 — Changeset + docs + commit boundaries

**ID**: phase_7
**Touched files**:
- `.changeset/surface-scoped-model-policy.md` (new)
- `notes/agent-builder-integrations/MODEL-POLICY-SURFACE-SCOPING.md` (companion doc, new)

**Subtasks**:
- [ ] `p7_changeset` — Add minor-bump changeset for `@mastra/core`, `@mastra/server`, `@mastra/client-js`, `@mastra/playground`.
- [ ] `p7_docs` — Write companion doc: surface semantics, how to add a new surface, future editor-policy extension point at `editor.editorAgents.modelPolicy`.
- [ ] `p7_commit` — Commit per the boundaries below (one commit per phase).

**Done when**:
- Changeset added.
- Companion doc committed alongside the plan.
- 7 commits stacked locally on the branch.

---

## Commit Boundaries

1. `feat(core): add ModelPolicy type + ModelPolicySurface enum`
2. `feat(server): surface-scoped resolveModelPolicy + drop save-path enforcement`
3. `feat(playground): ModelPolicyContext + useModelPolicy hook`
4. `refactor(playground): LLM components read ModelPolicyContext`
5. `feat(playground): wrap builder + editor routes with ModelPolicyProvider and migrate consumers` (5a + 5b together if 5a is trivial; otherwise two commits)
6. `feat(client-js): ModelPolicy type alias + regen route types`
7. `chore: changeset + docs for surface-scoped model policy`

## Verification

### Automated
- [ ] `pnpm --filter @mastra/core test agent-builder/ee`
- [ ] `pnpm --filter @mastra/server test resolve-model-policy stored-agents editor-builder`
- [ ] `pnpm --filter @mastra/playground test domains/llm domains/agents/components domains/agent-builder`
- [ ] `pnpm --filter @mastra/client-js build && pnpm --filter @mastra/client-js test`
- [ ] `pnpm --filter @mastra/playground typecheck` — no new errors vs. baseline

### Manual smoke (record results inline)
1. Configure builder with `editor.builder.modelPolicy = { active: true, allowed: [{ provider: 'openai' }], pickerVisible: false }`.
2. **Builder route** → provider dropdown shows only `openai`, lock chip visible.
3. **CMS editor route** → provider dropdown shows ALL providers (anthropic, google, etc.), no lock chip.
4. **Composer rendered inside builder preview** → only `openai`, lock chip.
5. **Composer rendered inside editor preview** → ALL providers, no lock chip.
6. **Standalone chat (no provider wrap)** → ALL providers (defaults to inactive).
7. Save an agent from CMS editor with a non-allowed model → succeeds (server enforcement removed).
8. Save an agent from builder UI with a non-allowed model → blocked at UI (picker doesn't expose it).

## Risks

- **Composer rendered outside any provider** silently defaults to inactive policy. Mitigation: add a render test asserting composer mounted inside builder shell inherits builder policy, and add a console.warn in dev mode if `useModelPolicy()` is called without a provider in the tree.
- **Server-side enforcement removal** means a malicious client could POST a disallowed model. Acceptable for this release because the install base is internal; UI gating is sufficient. Future editor policy PR can restore server enforcement.
- **Deprecated aliases stick around** for one release. Track removal in vNext milestone.
