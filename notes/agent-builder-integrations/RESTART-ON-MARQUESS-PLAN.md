# Restart on `yj/magnificent-marquess`: extend `ToolProvider` with v1 capabilities

**Status:** ✅ All phases (1–13) complete. PR #16837 open against `yj/magnificent-marquess`. PR #16672 closed as superseded. Interactive OAuth smoke scenarios deferred to manual reviewer pass — see `RESTART-SMOKE-RESULTS.md` and `RESTART-SMOKE-TEST.md`.
**Base branch:** `yj/magnificent-marquess`
**New branch:** `yj/mm/v1-tool-provider-extensions`
**Reference (read-only):** `yj/mm/v1-integrations-plan` (archive — source for porting logic; symbols translated `ToolIntegration` → `ToolProvider` as we paste)

## Mid-flight notes

- **v1 surface is additive, v2 methods are optional.** The legacy `ToolProvider` keeps its existing `listToolkits` / `listTools` / `resolveTools` signatures intact. New methods (`listToolkitsV2`, `listToolsV2`, `resolveToolsV2`, `authorize`, `listConnectionFields`, `getAuthStatus`, `getConnectionStatus`, `listConnections`, `getHealth`, `revokeConnection`) are all marked `?`. `capabilities` is also optional so legacy adapters compile unchanged. `BaseToolProvider` bridges legacy↔v2 by forwarding `listToolkits`/`listTools` into the v2 envelopes.
- **Vocabulary kept marquess-native.** Used `toolkit` (existing on marquess) instead of `toolService` (archive vocab). Internal symbols: `ToolProviderConnection`, `ToolProviderToolMeta`, `ToolProviderConfig`, `ToolProviders`, `ToolProviderCapabilities`, `ToolProviderHealth`. Capability flag renamed `multipleConnectionsPerService` → `multipleConnectionsPerToolkit`.
- **Errors module: lightweight only for now.** Phase 1 ships `DuplicateToolProviderError` / `UnknownToolProviderError`. The `MastraError` IDs (`CALLER_SUPPLIED_USER_ID_MISSING`, etc.) are emitted inline from `runtime.ts` — no separate ID registry file is needed yet. If subsequent phases need more IDs we can collect them then.

> No `ToolIntegration` exists on `magnificent-marquess`. All work is **extend the existing `ToolProvider` interface** or **add new files** under existing `tool-provider*` paths. Zero renames on the working branch.

---

## Locked defaults

| Decision | Value | Notes |
|---|---|---|
| Base branch | `yj/magnificent-marquess` | Has agent-builder + RBAC + channels; `main` lacks them |
| Interface | `ToolProvider` (existing) | Extend with optional methods + capability flags; additive only |
| Optional methods | Yes, marked `?` | Capability flags signal what each adapter supports |
| Adapter class names | `ComposioToolProvider`, `ArcadeToolProvider` | Existing names; Composio gets full surface, Arcade keeps minimal |
| Storage table | `mastra_tool_provider_connections` | New table — doesn't exist on marquess |
| Storage domain folder | `packages/core/src/storage/domains/tool-provider-connections/` | New folder |
| Server route prefix | `/tool-providers/*` | Extend existing prefix with new routes |
| Client-js resource | `client.toolProviders` | Extend existing resource with new methods |
| UI folder | `packages/playground/src/domains/tool-providers/` | Existing folder; add new files alongside legacy ones, then delete legacy |
| Form field name | `toolProviders` (in stored agent schema) | New field — doesn't exist on marquess today |
| Mastra config field | `toolProviders` | Already exists on `yj/magnificent-marquess`, no change |
| Scope enum | `per-author` \| `shared` \| `caller-supplied` | Verbatim from archive |
| `Connection.kind` | `'author'` only for v1 | Same as archive |
| Storage seeding | Delete example `mastra.db` for reseed | No install base, no migration |
| MCP convergence | **Deferred** — out of scope | Separate follow-up PR. Existing `packages/mcp/` system stays untouched and continues working as-is |
| Archive branch | Keep `yj/mm/v1-integrations-plan` for reference | Rename to `…-archive` after PR opens |
| Old PR (#16672) | Close with link to new PR | Reviewers re-review from clean diff |

---

## Phase 1: Branch setup + core types (`p1_*`) ✅ complete

**Status:** complete — commit `6c7a63b199` (5 files, +774 / −12)

**Subtasks:**
- ✅ `p1_branch` — created `yj/mm/v1-tool-provider-extensions` off `yj/magnificent-marquess`
- ✅ `p1_core_types` — extended `packages/core/src/tool-provider/types.ts` with optional surface (ToolProviderConnection, scope, AuthFlowStatus, capabilities, list/auth/health methods)
- ✅ `p1_core_errors` — added `packages/core/src/tool-provider/errors.ts` (`DuplicateToolProviderError`, `UnknownToolProviderError`; runtime emits inline `MastraError` for `CALLER_SUPPLIED_USER_ID_MISSING`)
- ✅ `p1_core_base` — added `packages/core/src/tool-provider/base.ts` (`BaseToolProvider` abstract with allowlist filtering + legacy↔v2 bridging)
- ✅ `p1_core_runtime` — added `packages/core/src/tool-provider/runtime.ts` (`resolveStoredToolProviders` fan-out + scope resolver)
- ✅ `p1_core_index` — updated `packages/core/src/tool-provider/index.ts` exports
- ✅ `p1_typecheck` — `pnpm --filter @mastra/core build:lib` + `tsc --noEmit` clean

**Touched files:**
- `packages/core/src/tool-provider/types.ts` (extend, ~+300 LOC)
- `packages/core/src/tool-provider/errors.ts` (new, ~30 LOC)
- `packages/core/src/tool-provider/base.ts` (new, ~160 LOC, port from `tool-integration/base.ts`)
- `packages/core/src/tool-provider/runtime.ts` (new, ~195 LOC, port from `tool-integration/runtime.ts`)
- `packages/core/src/tool-provider/index.ts` (re-export new symbols)

**Done when:**
- `ToolProvider` interface gains optional methods + `capabilities` field
- All types (`Connection`, `Scope`, `AuthFlowStatus`, `ToolProviderHealth`, `ListConnectionsOpts`, `ConnectionField`, etc.) exported from `@mastra/core/tool-provider`
- `BaseToolProvider` abstract class compiles
- `runtime.ts` resolver handles all three scopes + throws `MastraError` for missing context
- `@mastra/core` builds clean

---

## Phase 2: Storage domain (`p2_*`)

**Subtasks:**
- `p2_constants` — add `TABLE_TOOL_PROVIDER_CONNECTIONS` + schema constant in `packages/core/src/storage/constants.ts`
- `p2_types` — add `StorageToolProviderConnection` + list/upsert/delete input types in `packages/core/src/storage/types.ts`
- `p2_domain_folder` — create `packages/core/src/storage/domains/tool-provider-connections/` (port `base.ts`, `inmemory.ts`, `inmemory.test.ts` from archive's `tool-integration-connections/`)
- `p2_base_accessor` — add `Storage.toolProviderConnections` accessor in `packages/core/src/storage/base.ts`
- `p2_inmemory_db` — add `toolProviderConnections` field to `InMemoryDB` in `packages/core/src/storage/domains/inmemory-db.ts`
- `p2_mock` — wire `toolProviderConnections` into `packages/core/src/storage/mock.ts`
- `p2_operations` — add table to `packages/core/src/storage/domains/operations/inmemory.ts` table registry
- `p2_tests` — `pnpm --filter @mastra/core test src/storage` clean
- `p2_build` — `pnpm --filter @mastra/core build:lib` clean

**Touched files:**
- `packages/core/src/storage/constants.ts` (add 2 exports)
- `packages/core/src/storage/types.ts` (add 4 types)
- `packages/core/src/storage/base.ts` (add accessor)
- `packages/core/src/storage/domains/index.ts` (export new domain)
- `packages/core/src/storage/domains/tool-provider-connections/base.ts` (new ~60 LOC)
- `packages/core/src/storage/domains/tool-provider-connections/inmemory.ts` (new ~85 LOC)
- `packages/core/src/storage/domains/tool-provider-connections/inmemory.test.ts` (new ~280 LOC)
- `packages/core/src/storage/domains/tool-provider-connections/index.ts` (new exports)
- `packages/core/src/storage/domains/inmemory-db.ts` (add field)
- `packages/core/src/storage/domains/operations/inmemory.ts` (register table literal)
- `packages/core/src/storage/mock.ts` (add accessor)

**Done when:**
- In-memory store passes all 15 ported tests
- `Storage.toolProviderConnections` accessor compiles on `MockStore`
- Core builds clean

---

## Phase 3: Storage adapters (`p3_*`)

**Subtasks:**
- `p3_libsql_folder` — create `stores/libsql/src/storage/domains/tool-provider-connections/` (port `index.ts` + `index.test.ts` from archive, ~440 LOC total)
- `p3_libsql_accessor` — wire accessor into `stores/libsql/src/storage/index.ts`
- `p3_libsql_table_literal` — update `createTable` to use `mastra_tool_provider_connections`
- `p3_clickhouse` — add `mastra_tool_provider_connections` to `stores/clickhouse/src/storage/db/utils.ts` table registry
- `p3_cloudflare` — add entry to `stores/cloudflare/src/kv/storage/types.ts` KV type map
- `p3_tests_libsql` — `pnpm --filter @mastra/libsql test src/storage/domains/tool-provider-connections` clean
- `p3_build_libsql` — `pnpm --filter @mastra/libsql build:lib` clean
- `p3_build_clickhouse` — `pnpm --filter @mastra/clickhouse build:lib` clean
- `p3_build_cloudflare` — `pnpm --filter @mastra/cloudflare build:lib` clean

**Touched files:**
- `stores/libsql/src/storage/domains/tool-provider-connections/index.ts` (new ~221 LOC)
- `stores/libsql/src/storage/domains/tool-provider-connections/index.test.ts` (new ~220 LOC)
- `stores/libsql/src/storage/index.ts` (add import + accessor)
- `stores/clickhouse/src/storage/db/utils.ts` (1 line)
- `stores/cloudflare/src/kv/storage/types.ts` (3 lines)

**Done when:**
- libsql adapter passes 12 ported tests
- All three storage adapters build clean

---

## Phase 4: Composio adapter (`p4_*`)

**Subtasks:**
- `p4_delete_legacy` — delete `packages/editor/src/providers/composio.ts` (2-method legacy)
- `p4_port_full` — port the full `ComposioToolIntegration` class from archive to `packages/editor/src/providers/composio.ts`, renaming class to `ComposioToolProvider` and all type imports from `@mastra/core/tool-integration` → `@mastra/core/tool-provider`
- `p4_arcade` — confirm `packages/editor/src/providers/arcade.ts` still compiles (legacy 2-method shape is valid against extended interface — all new methods are optional)
- `p4_re_export` — `packages/editor/src/composio.ts` already exports `ComposioToolProvider` — confirm no change needed
- `p4_test_adapter` — run any existing composio adapter tests (the archive's adapter tests transfer 1:1)
- `p4_build_editor` — `pnpm --filter @mastra/editor build:lib` clean

**Touched files:**
- `packages/editor/src/providers/composio.ts` (replace with archive's `ComposioToolIntegration` class, renamed)
- `packages/editor/src/composio.ts` (no change — already re-exports `ComposioToolProvider`)

**Done when:**
- `ComposioToolProvider` implements full `ToolProvider` interface (authorize, listConnections, revokeConnection, etc.)
- `ArcadeToolProvider` still implements 2-method shape and compiles (capabilities flag signals limited surface)
- Editor builds clean

---

## Phase 5: Server (`p5_*`)

**Subtasks:**
- `p5_schemas` — extend `packages/server/src/server/schemas/tool-providers.ts` with: scope enum, connection schemas, authorize/list/disconnect/usage/health schemas (port from archive's `tool-integrations.ts`)
- `p5_handlers_authorize` — add `AUTHORIZE_TOOL_PROVIDER_ROUTE` to `packages/server/src/server/handlers/tool-providers.ts`
- `p5_handlers_connections` — add `LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE`, `DELETE_TOOL_PROVIDER_CONNECTION_ROUTE`, `GET_TOOL_PROVIDER_CONNECTION_USAGE_ROUTE`
- `p5_handlers_fields` — add `LIST_TOOL_PROVIDER_CONNECTION_FIELDS_ROUTE`
- `p5_handlers_health` — add `GET_TOOL_PROVIDER_HEALTH_ROUTE`
- `p5_route_registration` — register new routes in `packages/server/src/server/server-adapter/routes/tool-providers.ts`
- `p5_tests` — port `tool-integrations.test.ts` → `tool-providers.test.ts` (~48 tests)
- `p5_build` — `pnpm --filter @mastra/server build:lib` clean

**Touched files:**
- `packages/server/src/server/schemas/tool-providers.ts` (extend, ~+250 LOC)
- `packages/server/src/server/handlers/tool-providers.ts` (extend, ~+550 LOC)
- `packages/server/src/server/handlers/tool-providers.test.ts` (port from archive, ~48 tests)
- `packages/server/src/server/server-adapter/routes/tool-providers.ts` (register new routes)

**Done when:**
- All new routes return correct shapes and respect scope/auth
- `getStore('toolProviderConnections')` resolves the new accessor
- 48 ported tests pass
- Server builds clean

---

## Phase 6: Client-js (`p6_*`)

**Subtasks:**
- `p6_resource` — extend `client-sdks/client-js/src/resources/tool-provider.ts` with new methods (`authorize`, `listConnections`, `disconnect`, `getConnectionUsage`, `listConnectionFields`, `getHealth`)
- `p6_tests` — port `tool-integration.test.ts` → `tool-provider.test.ts` (~187 LOC)
- `p6_route_types` — regenerate `client-sdks/client-js/src/route-types.generated.ts` against new server routes
- `p6_types_export` — export `Connection`, `Scope`, `ConnectionField` etc. from `client-sdks/client-js/src/types.ts`
- `p6_build` — `pnpm --filter @mastra/client-js build:lib` clean

**Touched files:**
- `client-sdks/client-js/src/resources/tool-provider.ts` (extend, ~+180 LOC)
- `client-sdks/client-js/src/resources/tool-provider.test.ts` (port from archive)
- `client-sdks/client-js/src/route-types.generated.ts` (regenerated)
- `client-sdks/client-js/src/types.ts` (add type re-exports)

**Done when:**
- All new methods callable on `client.toolProviders.*`
- Generated route types include new endpoints
- Client-js builds clean

---

## Phase 7: UI — connection picker + section (`p7_*`)

**Subtasks:**
- `p7_delete_legacy_ui` — delete current legacy UI files in `packages/playground/src/domains/tool-providers/` (superseded by the new picker)
- `p7_port_components` — add `connection-picker.tsx`, `tool-providers-section.tsx`, `health-pill.tsx` (port logic from archive; rename symbols `ToolIntegrationsSection` → `ToolProvidersSection` during the paste)
- `p7_port_hooks` — add new hooks: `use-authorize`, `use-infinite-connections`, `use-disconnect-connection`, `use-connection-status`, `use-connection-fields`, `use-connection-usage`, `use-existing-connections`, `use-agent-health`, `use-tool-services`, `use-tools`, `use-all-integration-tools` (translate imports from `@mastra/core/tool-integration` → `@mastra/core/tool-provider` during paste)
- `p7_port_schemas` — add `packages/playground/src/domains/tool-providers/schemas.ts`
- `p7_port_mappers` — add `packages/playground/src/domains/tool-providers/mappers/tool-providers-form-mappers.ts`
- `p7_index` — update `packages/playground/src/domains/tool-providers/index.ts` to export new public symbols
- `p7_tests` — add `connection-picker.test.tsx`, `health-pill.test.tsx`, `use-agent-health.test.tsx`
- `p7_typecheck` — `pnpm --filter @mastra/playground typecheck` (no new errors vs marquess baseline)

**Touched files:**
- DELETE: `packages/playground/src/domains/tool-providers/components/tool-provider-dialog.tsx`
- DELETE: `packages/playground/src/domains/tool-providers/components/toolkit-list.tsx`
- DELETE: `packages/playground/src/domains/tool-providers/components/selected-tool-list.tsx`
- DELETE: `packages/playground/src/domains/tool-providers/components/integration-tools-section.tsx`
- DELETE: `packages/playground/src/domains/tool-providers/components/tool-list.tsx`
- DELETE: `packages/playground/src/domains/tool-providers/hooks/use-provider-tools.ts`
- DELETE: `packages/playground/src/domains/tool-providers/hooks/use-toolkits.ts`
- REPLACE: `packages/playground/src/domains/tool-providers/hooks/use-tool-providers.ts` (replace 2-method version with new shape)
- NEW: `packages/playground/src/domains/tool-providers/schemas.ts` (~136 LOC)
- NEW: `packages/playground/src/domains/tool-providers/mappers/tool-providers-form-mappers.ts` (~111 LOC)
- NEW: `packages/playground/src/domains/tool-providers/components/{connection-picker,tool-providers-section,health-pill}.tsx`
- NEW: `packages/playground/src/domains/tool-providers/hooks/{use-authorize,use-infinite-connections,...}.ts` (11 new hooks)
- NEW: corresponding `.test.tsx`/`.test.ts` files

**Done when:**
- Picker UI mounts and shows tools from `/tool-providers/*` endpoints
- All ported component + hook tests pass
- No new typecheck errors

---

## Phase 8: Form integration (agent-builder + CMS) (`p8_*`)

**Subtasks:**
- `p8_storage_schema` — add `toolProviders` field to `StorageStoredAgent` in `packages/core/src/storage/types.ts`
- `p8_ab_schema` — add `toolProviders` to agent-builder form schema in `packages/playground/src/domains/agent-builder/schemas.ts`
- `p8_ab_mapper` — add `toolProviders` round-trip in agent-builder form mapper
- `p8_ab_section_mount` — mount `<ToolProvidersSection>` in `packages/playground/src/domains/agent-builder/components/agent-builder-edit/details/connections-detail.tsx`
- `p8_cms_schema` — add `toolProviders` to CMS form schema in `packages/playground/src/domains/agents/hooks/use-agent-cms-form.ts` + `compute-agent-initial-values.ts`
- `p8_cms_mount` — mount `<ToolProvidersSection defaultScope="caller-supplied">` in `packages/playground/src/domains/agents/components/agent-cms-pages/tools-page.tsx`
- `p8_tests` — run agent-builder + CMS form tests (~149 tests ported from archive)

**Touched files:**
- `packages/core/src/storage/types.ts` (add `StorageStoredAgent.toolProviders`)
- `packages/playground/src/domains/agent-builder/schemas.ts`
- `packages/playground/src/domains/agent-builder/mappers/*` (add `toolProviders` mapper)
- `packages/playground/src/domains/agent-builder/components/agent-builder-edit/details/connections-detail.tsx`
- `packages/playground/src/domains/agents/hooks/use-agent-cms-form.ts`
- `packages/playground/src/domains/agents/utils/compute-agent-initial-values.ts`
- `packages/playground/src/domains/agents/components/agent-cms-pages/tools-page.tsx`

**Done when:**
- Builder and CMS both show + save `toolProviders` round-trip
- 149 ported tests pass

---

## Phase 9: Model policy (cherry-pick) (`p9_*`)

**Subtasks:**
- `p9_cherry_picks` — cherry-pick model-policy commits from archive (they're tool-provider-independent):
  - `c3b816d62a` — feat(core): rename BuilderModelPolicy to ModelPolicy with surface
  - `2fa5f2bb20` — feat(server): surface-scoped resolveModelPolicy + drop save-path enforcement
  - `807e49e08e` — feat(client-js): add getModelPolicy + ModelPolicy export
  - `d2768949cb` — feat(playground): ModelPolicyProvider + useModelPolicy hook
  - `b903bb6ea0` — feat(playground): migrate LLMProviders + LLMModels to useModelPolicy
  - `6b22b373af` — feat(playground): mount ModelPolicyProvider per surface + migrate consumers
  - `96da5c3408` — docs: changeset + surface model-policy companion doc
- `p9_conflict_resolution` — resolve any conflicts (likely minor — model policy doesn't touch tool-provider files directly)
- `p9_tests` — run model-policy tests
- `p9_build` — affected packages build clean

**Touched files:** see commit list

**Done when:**
- Model policy is surface-scoped (builder vs editor)
- LLM picker components use `useModelPolicy()`
- All affected tests pass

---

## Phase 10: RBAC + example wiring (`p10_*`)

**Subtasks:**
- `p10_rbac_fix` — cherry-pick `111a679729` (fix(auth/ee): bind getPermissionsForRole + wire RBAC in example)
- `p10_example_index` — confirm `examples/agent-builder/src/mastra/index.ts`: `ComposioToolProvider` import + `toolProviders: { composio: new ComposioToolProvider(...) }` config (already on magnificent-marquess, just verify after extension)
- `p10_example_db` — delete `examples/agent-builder/src/mastra/public/mastra.db` for reseed
- `p10_capabilities_check` — confirm `/capabilities` returns `{ rbac: true }` when WorkOS is wired (boot example, hit endpoint)

**Touched files:**
- `examples/agent-builder/src/mastra/index.ts`
- `examples/agent-builder/src/mastra/public/mastra.db` (delete)

**Done when:**
- Example boots clean against the new `ToolProvider` surface
- `/capabilities` reports `rbac: true` with WorkOS env vars present
- Storage reseeds with `mastra_tool_provider_connections` table created

---

## Phase 11: Smoke test (`p11_*`)

Run before opening PR. Full checklist lives in [`RESTART-SMOKE-TEST.md`](./RESTART-SMOKE-TEST.md).

**Subtasks:**
- `p11_smoke_run` — work through all 9 scenarios in `RESTART-SMOKE-TEST.md` (per-author, shared, caller-supplied, admin cross-author, capabilities flag, mixed scopes, disconnect, health pill, MCP regression)
- `p11_smoke_capture` — capture screenshots / clips for PR description

**Touched files:** none (test only)

**Done when:**
- All 9 scenarios in `RESTART-SMOKE-TEST.md` pass on a fresh `mastra.db`
- No regressions in Arcade or MCP paths

---

## Phase 12: Docs + changeset (`p12_docs_*`)

**Subtasks:**
- `p12_changeset` — single `.changeset/v1-tool-provider-extensions.md` describing all new capabilities on `ToolProvider`
- `p12_docs_reference` — update `docs/src/content/en/reference/editor/tool-provider.mdx` with new capabilities (authorize, connections, scope, multi-tenant)
- `p12_docs_multi_tenant` — port `notes/agent-builder-integrations/multi-tenant-deployment.md` to `docs/src/content/en/docs/agent-builder/multi-tenant-connections.mdx`
- `p12_archive_notes` — move `notes/agent-builder-integrations/` contents to `notes/agent-builder-integrations/archive/` (the greenfield plans become historical)
- `p12_delete_archive_branch_after_merge` — defer until PR merges; rename `yj/mm/v1-integrations-plan` → `…-archive`

**Touched files:**
- `.changeset/v1-tool-provider-extensions.md` (new)
- `docs/src/content/en/reference/editor/tool-provider.mdx` (extend)
- `docs/src/content/en/docs/agent-builder/multi-tenant-connections.mdx` (new)
- `notes/agent-builder-integrations/archive/*` (moved)

**Done when:**
- Single changeset bumps `@mastra/core`, `@mastra/server`, `@mastra/client-js`, `@mastra/playground`, `@mastra/libsql`, `@mastra/clickhouse`, `@mastra/cloudflare`, `@mastra/editor` (minor)
- Reference docs describe new `ToolProvider` surface
- Multi-tenant guide published

---

## Phase 13: PR (`p13_*`)

**Subtasks:**
- `p13_push` — push `yj/mm/v1-tool-provider-extensions` to origin
- `p13_open_pr` — open PR against `yj/magnificent-marquess` (not `main` — marquess is the integration target)
- `p13_close_old_pr` — close PR #16672 with comment linking to new PR
- `p13_rename_archive` — rename local + remote `yj/mm/v1-integrations-plan` → `yj/mm/v1-integrations-plan-archive`

**Done when:**
- New PR open with clean diff (one name, one folder per concern)
- Old PR closed cleanly
- Archive branch preserved for git history reference

---

## Cherry-pick map (archive → new branch)

Self-contained commits that can be cherry-picked verbatim once the core/server/UI scaffolding exists. For everything else, port files directly into the new paths (cherry-pick conflicts get expensive when paths differ):

| Archive commit | What it adds | Cherry-pick phase |
|---|---|---|
| `f3e744fa80` | core: caller-supplied scope | Already covered in `p1_core_types` |
| `bb3759d05f` | server: caller-supplied scope routes | Already in `p5_*` |
| `cd28bba63b` | client-js: caller-supplied scope types | Already in `p6_*` |
| `422eaa3e41` | picker: caller-supplied UI | Already in `p7_*` |
| `b37d1ddbea` | cms: default scope | Already in `p8_*` |
| `c3b816d62a` + `2fa5f2bb20` + `807e49e08e` + `d2768949cb` + `b903bb6ea0` + `6b22b373af` + `96da5c3408` | model-policy surface scoping | Phase 9 (cherry-pick block) |
| `111a679729` | RBAC binding fix | Phase 10 |
| `a69b772a7d` | server: filter stored agents by visibility | Phase 10 (if not already on marquess) |

Most other commits should be **re-implemented** by porting files from archive into the new file paths, not cherry-picked — the path renames make cherry-picks too conflict-heavy.

---

## Total estimate

| Phase | Hours |
|---|---|
| 1. Core types + base + runtime | 4 |
| 2. Storage domain | 2 |
| 3. Storage adapters | 1 |
| 4. Composio adapter | 2 |
| 5. Server | 5 |
| 6. Client-js | 2 |
| 7. UI picker + section | 3 |
| 8. Form integration | 2 |
| 9. Model policy cherry-picks | 2 |
| 10. RBAC + example | 1 |
| 11. Docs + changeset | 2 |
| 12. PR | 0.5 |
| **Total** | **~26.5 hours ≈ 3.5 working days** |

---

## Out of scope (defer to follow-up PRs)

- **MCP convergence** — existing `packages/mcp/` system stays untouched and continues working as-is. A future PR can add an `MCPToolProvider` adapter that implements the new `ToolProvider` surface, but that's separate. No code in this PR touches `packages/mcp/`.
- Admin page at `/integrations/connections`
- Connection rename UX (already dropped in archive)
- Workflow tool-provider integration (only agents for v1)
- Storage migration (no install base — fresh table, delete example db)

---

## Risk register

| Risk | Mitigation |
|---|---|
| Archive branch deleted before PR merges | Keep `yj/mm/v1-integrations-plan-archive` indefinitely; document in PR |
| Reviewer fatigue from 3rd round of integration work | PR description explicitly references this plan + WHY-NEW-INTEGRATION.md decision |
| Magnificent-marquess merges to main during restart | Rebase as needed; no expected conflicts in `tool-provider/` files |
| Optional method `?:` pollution | Capability flags + adapter doc clarify which methods each adapter supports |
| Existing legacy `ArcadeToolProvider` doesn't implement new methods | Intentional — capabilities flag `{ authorize: false }` signals limited surface; works as-is |

---

## Definition of done (whole plan)

- New branch `yj/mm/v1-tool-provider-extensions` open as PR against `yj/magnificent-marquess`
- One `ToolProvider` interface, optional methods, capability flags
- One `tool-provider-connections` storage domain across core + libsql + clickhouse + cloudflare
- One `/tool-providers/*` route prefix
- One `client.toolProviders` client-js resource
- One `tool-providers/` UI folder
- One changeset
- Composio adapter implements full surface; Arcade adapter implements minimal surface
- Smoke test passes for all three scopes (per-author, shared, caller-supplied)
- MCP system untouched and still working
- Archive branch preserved
- Old PR #16672 closed cleanly
