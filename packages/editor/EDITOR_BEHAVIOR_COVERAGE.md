# Editor Product Behavior Coverage

This is the coverage map for the **Studio editor product**, not just the `@mastra/editor` package. The primary view is workflow-first: every user-visible editor behavior should map to a named scenario, a proof layer, and an assertion on product outcome. Package-level editor scenarios remain valuable, but they are classified as runtime invariants rather than the product suite.

## Coverage rules

- **Primary product proof**: `packages/playground` no-mock BDD tests using real `@mastra/client-js`, React Query, Studio components/routes, MSW-only network mocking, typed fixtures, and shared helpers from `packages/playground/src/test/render.tsx`.
- **Playwright proof**: only for behavior MSW cannot model: real browser navigation/reload, streaming, source-control/file download, real server persistence, focus/drag-drop/file upload.
- **Server proof**: route contracts, schema validation, permissions/scope/visibility, route ordering, export/change-request endpoints, retention/version edge cases.
- **Editor package proof**: runtime invariants that are below Studio: namespace cache semantics, source routing, runtime hydration, conditional resolution, provider fallback, Mastra registration.
- **Do not count UI-only assertions as product coverage**. Each scenario must assert persisted data, request payloads, runtime output, access-control result, route redirect, or cache/query invalidation that changes product behavior.

## Status legend

| Status | Meaning |
| --- | --- |
| Covered | A test at the correct proof layer already asserts the product behavior. |
| Needs product MSW | Add/expand a no-mock Playground BDD component/route/hook scenario. |
| Needs Playwright | Add/expand an E2E scenario because browser/server behavior is required. |
| Server contract | Covered or targeted as handler/schema/permission/route tests. |
| Editor invariant | Covered or targeted by `packages/editor/src/e2e-scenarios`. |
| Blocked | Behavior cannot be automated yet; risk/needed seam is documented. |
| Not applicable | Static export/type-only/non-product behavior. |

## Product scenario matrix

### Agent Builder

| Scenario ID | User story | Route/page | Backing editor namespace(s) | Server endpoints | Proof layer | Current test file | Assertion type | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BUILDER-001 | A user creates an agent from a starter/freeform prompt and gets a persisted editable agent. | `/agent-builder/agents/create` → `/agent-builder/agents/:id/edit` | agent, skill, workspace, builder | `/api/agent-builder/*`, `/api/stored/agents` | Playwright | `packages/playground/e2e/tests/agent-builder/deterministic-builder.spec.ts` | tool calls, redirect, stored draft, reload persistence | Covered |
| BUILDER-002 | A user reopens a generated builder agent and sees the saved name/description/config. | `/agent-builder/agents/:id/edit` | agent | `/api/stored/agents/:id` | Playwright + MSW | `deterministic-builder.spec.ts`; `use-stored-agents.editor.msw.test.tsx` | reload persistence and detail query payload | Covered |
| BUILDER-003 | A user favorites/unfavorites builder agents and filtered lists reflect the server state. | `/agent-builder/favorite`, agent list rows | favorites, agent | `/api/stored/agents/:id/favorite`, `/api/stored/agents?favoritedOnly` | Playground MSW | `use-stored-agent-favorite.editor.msw.test.tsx`, `use-stored-agents.editor.msw.test.tsx` | optimistic cache, rollback, `favoritedOnly`, `pinFavoritedFor` params | Covered: the product contract is the shared favorite mutation/list filter used by builder and CMS lists; no separate route proof required. |
| BUILDER-004 | Builder settings disable product affordances when the server disables the builder. | `/agent-builder/*` | builder | `/api/editor/builder/settings` | Playground MSW | `use-builder-settings.editor.msw.test.tsx`; existing `agent-builder/agents/create.test.tsx` | enabled option, disabled settings state, create-page settings request | Covered: settings contract is product-shared; route test exists but is not counted until its legacy `vi.mock` seams are refactored. |
| BUILDER-005 | Model policy and picker allowlists restrict model/tools/agents/workflows available in builder. | builder edit/create forms | builder, agent | `/api/editor/builder/settings`, `/api/editor/builder/models` | Playground MSW | `use-builder-settings.editor.msw.test.tsx`; `agent-cms-pages.editor.msw.test.tsx`; existing builder hook tests | feature flags, policy, picker allowlist, warnings, provider/model component filtering | Covered: no-mock component proof covers model picker filtering; builder route test refactor remains tracked separately from editor coverage. |
| BUILDER-006 | Role-gated users can only perform permitted builder actions. | `/agent-builder/*` | builder, agent, skill | auth capabilities + stored resource endpoints | Playground MSW / Playwright | auth route-permission tests, `use-auth-capabilities.test.ts`, server handler tests | access-control outcome, hidden/blocked mutations | Covered by shared route-permission gate and server permission contracts; builder-specific route test is blocked on legacy builder route mocks and is not required for editor namespace proof. |
| BUILDER-007 | A generated agent appears in ordinary agent lists/favorites after creation. | `/agents`, `/agent-builder/favorite` | agent, favorites | `/api/stored/agents` | Playwright | `deterministic-builder.spec.ts` | cross-page persisted list visibility | Covered for ordinary agent list; favorites covered by MSW filters |

### Agent CMS editor

| Scenario ID | User story | Route/page | Backing editor namespace(s) | Server endpoints | Proof layer | Current test file | Assertion type | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AGENT-CMS-001 | A user lists, opens, creates, edits, and deletes stored agents. | `/agents`, `/cms/agents/create`, `/cms/agents/:id/edit` | agent | `/api/stored/agents`, `/api/stored/agents/:id` | Playground MSW | `use-stored-agents.editor.msw.test.tsx`; `agent-cms-pages.editor.msw.test.tsx` | request payloads, cache invalidation, 404 null handling, mounted section form state | Covered: hook tests own CRUD transport/cache; component tests own section-level product form behavior. |
| AGENT-CMS-002 | A user saves information fields and the persisted agent payload changes. | `/cms/agents/:id/edit/information` | agent | `PATCH /api/stored/agents/:id` | Playground MSW | `use-stored-agents.editor.msw.test.tsx`; `agent-cms-pages.editor.msw.test.tsx` | saved request payload, agent cache invalidation, mounted information form values | Covered |
| AGENT-CMS-003 | A user attaches prompt blocks/instruction blocks and preview reflects rules/request context. | agent prompt/instructions section | agent, prompt | `/api/stored/prompt-blocks`, `/api/stored/agents/:id/preview-instructions`, `PATCH /api/stored/agents/:id` | Playground MSW + editor invariant | `prompt-block-preview.scenario.test.ts`; `use-stored-agents.editor.msw.test.tsx`; prompt block MSW tests | preview output, persisted prompt-block refs | Covered: preview correctness requires the editor runtime invariant; Playground owns persisted instruction-block payloads. |
| AGENT-CMS-004 | A user overrides stored tool descriptions on an agent and runtime/tool payload uses the override. | tools section | agent, tool providers | `PATCH /api/stored/agents/:id` | Editor invariant + Playground MSW | `code-agent-stored-tool-description.scenario.test.ts`; `use-stored-agents.editor.msw.test.tsx`; `agent-cms-pages.editor.msw.test.tsx` | runtime tool description override, saved tool override payload, mounted tools section override editing | Covered |
| AGENT-CMS-005 | A user selects MCP clients and saved agent config hydrates them into runtime tools. | MCP clients section | agent, mcp | `/api/stored/mcp-clients`, `PATCH /api/stored/agents/:id` | Playground MSW + editor invariant | `mcp-client-definition.scenario.test.ts`; `use-stored-agents.editor.msw.test.tsx` | saved MCP client refs, runtime tool availability | Covered: persisted MCP refs and runtime hydration are covered; stored MCP client create/edit page is blocked separately in MCP-002 because Playground has no stored-client mutation seam wired to `/stored/mcp-clients`. |
| AGENT-CMS-006 | A user selects workflows/agents/tools and saved config contains the selected references. | tools/workflows/agents sections | agent | list endpoints + `PATCH /api/stored/agents/:id` | Playground MSW | `use-stored-agents.editor.msw.test.tsx`; `agent-cms-pages.editor.msw.test.tsx` | persisted refs in request payload, mounted workflow section selection | Covered |
| AGENT-CMS-007 | A user attaches scorers to an agent and persisted agent config references them. | scorer section | agent, scorer | `/api/stored/scorers`, `PATCH /api/stored/agents/:id` | Playground MSW | `use-stored-agents.editor.msw.test.tsx`; scorer MSW tests; `agent-cms-pages.editor.msw.test.tsx` | persisted scorer refs and mounted scorer section selection with sampling | Covered |
| AGENT-CMS-008 | A user attaches skills to an agent and persisted agent config references them. | skills section | agent, skill | `/api/stored/skills`, `PATCH /api/stored/agents/:id` | Playground MSW | `use-stored-agents.editor.msw.test.tsx`; skill MSW tests; `agent-cms-pages.editor.msw.test.tsx` | persisted skill refs and mounted skills section selection | Covered |
| AGENT-CMS-009 | A user edits memory, variables/request context schema, workspace, and browser settings. | memory/variables/workspace/browser sections | agent, workspace, builder | `PATCH /api/stored/agents/:id`, workspace endpoints | Playground MSW | `use-stored-agents.editor.msw.test.tsx`; `use-workspace-editor.msw.test.tsx`; `agent-cms-pages.editor.msw.test.tsx` | request payload, workspace queries, file write invalidation, mounted memory and variables form state | Covered |
| AGENT-CMS-010 | A user publishes/activates/restores/compares/deletes agent versions. | version controls in agent CMS | agent | `/api/stored/agents/:id/versions*` | Playground MSW + server contract | `use-agent-versions.editor.msw.test.tsx`, `agent-versions.test.ts` | version route params, invalidation, retention/active protection | Covered |
| AGENT-CMS-011 | A code-mode agent allows editable overrides, export JSON, and change request flow. | `/agents/:agentId/editor` for code-mode agents | agent, source provider | `/api/stored/agents/:id/export`, `/api/stored/agents/:id/change-request` | Playwright + server contract | `packages/playground/e2e/tests/cms/agents/code-agent-override.spec.ts`, `stored-agents.test.ts` | filesystem save, export payload, source-provider change request endpoint | Covered: Playwright proves local save/download; server contract proves change-request provider behavior |
| AGENT-CMS-012 | A locked `editor: false` code agent blocks override editing and export override baking. | code agent edit page | agent, source provider | export endpoint | Playwright + server contract | `code-agent-override.spec.ts` | buttons absent, server refuses overrides | Covered |

### Prompt blocks

| Scenario ID | User story | Route/page | Backing editor namespace(s) | Server endpoints | Proof layer | Current test file | Assertion type | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PROMPT-001 | A user creates, lists, opens, edits, and deletes prompt blocks. | `/prompts`, `/cms/prompts/create`, `/cms/prompts/:id/edit` | prompt | `/api/stored/prompt-blocks*` | Playground MSW | `use-stored-prompt-blocks.editor.msw.test.tsx` | params, request payloads, cache invalidation | Covered: CRUD contract is owned by shared stored-prompt-block hooks; route page has no additional editor namespace behavior beyond listing/edit form composition. |
| PROMPT-002 | A user edits content, rules, and request-context schema and preview changes accordingly. | prompt block edit page | prompt | prompt-block CRUD + preview/editor helper | Playground MSW + editor invariant | `prompt-block-preview.scenario.test.ts`; `use-stored-prompt-blocks.editor.msw.test.tsx` | rendered preview with variables/rules and persisted prompt payload | Covered: preview/rule evaluation is runtime/editor invariant; Playground hook tests assert persisted content/rules payload. |
| PROMPT-003 | A user creates/activates/restores/deletes prompt-block versions. | prompt block version controls | prompt | `/api/stored/prompt-blocks/:id/versions*` | Playground MSW + server contract | `use-prompt-block-versions.editor.msw.test.tsx` | route params, activation result, invalidation | Covered |
| PROMPT-004 | A published prompt block appears usable from an agent instruction-block flow. | prompt edit + agent CMS instructions | prompt, agent | prompt + agent endpoints | Playground MSW / Playwright | `use-stored-agents.editor.msw.test.tsx`; `prompt-block-preview.scenario.test.ts` | persisted prompt-block ref in agent payload and runtime prompt-block resolution | Covered |

### Scorers

| Scenario ID | User story | Route/page | Backing editor namespace(s) | Server endpoints | Proof layer | Current test file | Assertion type | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCORER-001 | A user creates/edits/deletes scorers with valid provider/model payload. | `/scorers`, `/cms/scorers/create`, `/cms/scorers/:id/edit` | scorer | `/api/stored/scorers*` | Playground MSW + Playwright | `use-stored-scorers.editor.msw.test.tsx`, scorer E2E page specs | request payload, validation, reload persistence | Covered; ensure matrix links E2E create/edit |
| SCORER-002 | A user publishes/versions/compares scorer definitions. | scorer edit/version controls | scorer | `/api/stored/scorers/:id/versions*` | Playground MSW + server contract | `use-scorer-versions.editor.msw.test.tsx` | compare `from/to`, activation, invalidation | Covered |
| SCORER-003 | A scorer definition resolves at runtime. | runtime scorer use | scorer | server scorer routes | Editor invariant | `scorer-runtime-resolution.scenario.test.ts` | resolved scorer config/runtime availability | Covered |
| SCORER-004 | A user attaches scorer to an agent and the agent payload persists the reference. | agent CMS scorer section | scorer, agent | `/api/stored/scorers`, `PATCH /api/stored/agents/:id` | Playground MSW | `use-stored-agents.editor.msw.test.tsx`; `agent-cms-pages.editor.msw.test.tsx` | persisted scorer reference in PATCH payload and mounted scorer section selection | Covered |

### Skills

| Scenario ID | User story | Route/page | Backing editor namespace(s) | Server endpoints | Proof layer | Current test file | Assertion type | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SKILL-001 | A user creates a skill and workspace files are written when permitted. | `/agent-builder/skills/create` or skill edit | skill, workspace | `/api/stored/skills`, workspace file routes | Playground MSW | `use-create-skill.test.tsx` | file writes, create payload, permission-gated write skip | Covered |
| SKILL-002 | A user copies a library skill into private stored skill metadata. | builder/library skill copy | skill | `POST /api/stored/skills` | Playground MSW | `use-copy-skill.test.tsx` | `library-copy` origin metadata, omitted null fields | Covered |
| SKILL-003 | A user opens/edits/autosaves/deletes skills. | skill edit/list pages | skill | stored skill CRUD | Playground MSW | `use-stored-skill.test.tsx`, `use-delete-skill.test.tsx`, existing autosave tests | detail gating, delete cache removal, autosave write path | Covered: existing skill component/hook tests exercise the edit/list product seams with MSW. |
| SKILL-004 | A user publishes a skill and affected agents invalidate/reload. | skill publish action | skill, agent | skill publish route, agent invalidation | Editor invariant + server contract | `skill-publish-agent-invalidation.scenario.test.ts` | invalidated runtime agent | Covered: publish correctness is runtime invalidation behavior that MSW cannot prove beyond route payloads. |
| SKILL-005 | A user favorites/unfavorites skills and lists update/rollback correctly. | skill list/favorites | skill, favorites | `/api/stored/skills/:id/favorite` | Playground MSW | `use-stored-skill-favorite.editor.msw.test.tsx` | optimistic cache, rollback, list invalidation | Covered |
| SKILL-006 | A user attaches a stored skill to an agent and the agent payload persists the reference. | agent CMS skill section | skill, agent | `/api/stored/skills`, `PATCH /api/stored/agents/:id` | Playground MSW | `use-stored-agents.editor.msw.test.tsx`; `agent-cms-pages.editor.msw.test.tsx` | persisted skill reference in PATCH payload and mounted skill-section selection | Covered |

### MCP

| Scenario ID | User story | Route/page | Backing editor namespace(s) | Server endpoints | Proof layer | Current test file | Assertion type | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MCP-001 | A user browses runtime MCP servers and opens tools. | `/mcps`, `/mcps/:serverId`, `/mcps/:serverId/tools/:toolId` | mcp-server | `/api/mcp/v0/servers`, `/api/mcp/:serverId/tools` | Playground MSW + Playwright | `use-mcp-servers.editor.msw.test.tsx`, MCP E2E page specs | route shape, tool map, callable tool output | Covered: hook MSW owns route shape/tool map; Playwright owns callable tool product behavior. |
| MCP-002 | A user creates/edits stored MCP clients. | MCP client create/list UI | mcp | `/api/stored/mcp-clients*` | Server contract + Playground MSW target | `stored-mcp-clients.test.ts`; `mcp-client-create-content.tsx` reviewed | schema, route ordering, version routes | Blocked for product MSW: current MCP client form emits `onAdd` config but has no Playground stored-client mutation hook/page wired to `/stored/mcp-clients`; server contract covers route until UI seam exists |
| MCP-003 | A stored MCP client attached to an agent hydrates into runtime tools. | agent CMS MCP section + runtime | mcp, agent | stored MCP + agent endpoints | Editor invariant + Playground MSW | `mcp-client-definition.scenario.test.ts`; `use-stored-agents.editor.msw.test.tsx` | runtime tool hydration and persisted MCP client ref | Covered: runtime hydration is editor invariant; Playground asserts persisted agent MCP refs. |
| MCP-004 | MCP server CRUD is managed from Studio. | n/a | mcp-server | no stored MCP server CRUD route | n/a | n/a | n/a | Blocked: runtime MCP discovery exists, stored server CRUD route does not |

### Workspace

| Scenario ID | User story | Route/page | Backing editor namespace(s) | Server endpoints | Proof layer | Current test file | Assertion type | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WORKSPACE-001 | A user lists stored workspaces and sees runtime-registered workspace indication. | `/workspaces` | workspace | `/api/stored/workspaces`, `/api/workspaces` | Playground MSW | `use-workspace-editor.msw.test.tsx`, `use-stored-workspaces.test.tsx` | query params, enabled gating, runtimeRegistered response state | Covered: workspace page has no editor-specific behavior beyond rendering the typed response state. |
| WORKSPACE-002 | A user browses files and skills in a workspace. | `/workspaces/:workspaceId`, `/workspaces/:workspaceId/skills/:skillName` | workspace, skill | workspace info/files/skills routes | Playground MSW | `use-workspace-editor.msw.test.tsx` | workspace info, files/skills query results, write invalidation | Covered: no additional editor namespace behavior exists in the page beyond these workspace data contracts. |
| WORKSPACE-003 | Skill creation/publish writes and reads workspace files. | skill create/edit | workspace, skill | workspace write/read + stored skills | Playground MSW | `use-create-skill.test.tsx` | workspace file writes and DB record | Covered |
| WORKSPACE-004 | Editor package resolves workspace snapshots/runtime refs. | runtime invariant | workspace, agent | n/a | Editor invariant | `workspace-snapshot-provider.scenario.test.ts` | hydrated workspace snapshot | Covered |

### Builder settings, gates, auth/RBAC

| Scenario ID | User story | Route/page | Backing editor namespace(s) | Server endpoints | Proof layer | Current test file | Assertion type | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GATE-001 | Builder disabled state prevents builder actions. | `/agent-builder/*` | builder | `/api/editor/builder/settings` | Playground MSW | `use-builder-settings.editor.msw.test.tsx`; existing builder route tests | disabled state/gated request | Covered: settings contract is asserted through real client-js; existing route tests are legacy-mocked and not counted as additional proof. |
| GATE-002 | Builder feature flags hide/disable tools, skills, memory, browser, model affordances. | builder edit/create | builder | settings route | Playground MSW | `use-builder-settings.editor.msw.test.tsx`; existing builder component/hook tests | feature-driven settings state and endpoint gating | Covered: no-mock settings tests verify the feature payload that all builder affordances consume; builder route refactor is blocked by legacy `vi.mock` seams. |
| GATE-003 | Model policy filters available models and warns on invalid configured IDs. | model picker | builder | settings/models routes | Playground MSW + server contract | `use-builder-settings.editor.msw.test.tsx`, `editor-builder.test.ts`, `agent-cms-pages.editor.msw.test.tsx` | policy/warnings/picker visibility, mounted provider/model filter contract | Covered |
| GATE-004 | Picker allowlists filter visible tools/agents/workflows. | builder pickers | builder | settings route + list endpoints | Playground MSW | builder settings tests; `agent-cms-pages.editor.msw.test.tsx` | allowlist Set/null semantics and mounted tools section membership gating | Covered |
| GATE-005 | RBAC gates read/write/execute paths for editor-backed resources. | builder and CMS routes | auth + editor namespaces | auth/capabilities + stored resource endpoints | Playground MSW + server contract | auth route-permission tests, `use-auth-capabilities.test.ts`, server handler tests | permitted vs denied actions | Covered by shared auth gate + server permission contracts; editor-specific route duplication is not required unless those gates diverge. |

## Editor package invariant scenarios

These files in `packages/editor/src/e2e-scenarios` are **not** the product scenario suite. They prove runtime invariants that Studio MSW cannot fully model.

| Invariant ID | Scenario file | Runtime invariant | Product matrix link |
| --- | --- | --- | --- |
| INV-001 | `agent-create-runtime.scenario.test.ts` | Stored agent registration reaches Mastra runtime and uses persisted instructions. | AGENT-CMS-001 |
| INV-002 | `agent-version-activation.scenario.test.ts` | Active version changes affect runtime resolution. | AGENT-CMS-010 |
| INV-003 | `code-agent-stored-tool-description.scenario.test.ts` | Stored overrides on code agents affect runtime tool descriptions. | AGENT-CMS-004, AGENT-CMS-011 |
| INV-004 | `favorites-filtering.scenario.test.ts` | Favorites namespace stores/filter resources. | BUILDER-003, SKILL-005 |
| INV-005 | `mcp-client-definition.scenario.test.ts` | Stored MCP client config hydrates runtime definitions. | MCP-003 |
| INV-006 | `mcp-server-runtime-registration.scenario.test.ts` | Runtime MCP server registration is discoverable. | MCP-001 |
| INV-007 | `prompt-block-preview.scenario.test.ts` | Prompt block variables/rules render deterministically. | PROMPT-002, AGENT-CMS-003 |
| INV-008 | `scorer-runtime-resolution.scenario.test.ts` | Stored scorers resolve into runtime-ready config. | SCORER-003 |
| INV-009 | `skill-publish-agent-invalidation.scenario.test.ts` | Skill publish invalidates dependent agent runtime. | SKILL-004 |
| INV-010 | `source-routing-code-provider.scenario.test.ts` | Code/source provider routing is honored. | AGENT-CMS-011 |
| INV-011 | `workspace-snapshot-provider.scenario.test.ts` | Workspace refs/snapshots hydrate correctly. | WORKSPACE-004 |

## Server contract traceability

Server tests support product coverage but are not product scenarios by themselves unless linked above.

| Contract area | Files | Expected proof |
| --- | --- | --- |
| Stored agents and versions | `packages/server/src/server/handlers/stored-agents.test.ts`, `agent-versions.test.ts` | CRUD, preview/dependents, export/change-request, favorites params, version activation/restore/delete/retention/active protection. |
| Stored skills | `stored-skills.test.ts` | CRUD, visibility/ownership/scope, favorites, publish/copy metadata, schema validation. |
| Prompt blocks | `stored-prompt-blocks.test.ts` and route/schema tests | CRUD, versions, preview-relevant fields, route ordering. |
| Stored MCP clients | `stored-mcp-clients.test.ts` | CRUD, server config schema, versions, `/compare` literal route before `/:versionId`. |
| Scorers | `stored-scorers.test.ts` | CRUD, model/provider payload, versions, compare, cache clearing. |
| Workspaces | `stored-workspaces.test.ts` | stored workspace CRUD, scope, runtimeRegistered annotation. |
| Builder settings/actions | `editor-builder.test.ts`, builder action tests | enabled/disabled state, features, model policy, picker warnings, lazy EE import, action execution contracts. |

## Source-file traceability appendix

The product matrix above is authoritative. This appendix keeps source inventory as a secondary trace so package files are not lost.

| Source area | Files | Runtime surface | Coverage classification |
| --- | --- | --- | --- |
| Editor root and providers | `src/index.ts`, `src/providers.ts`, `src/providers/*`, `src/arcade.ts`, `src/composio.ts`, `src/ee/*`, `src/storage/*` | editor registration, source mode, provider registries, builder resolution, blob/filesystem/source-provider contracts | Editor invariant + server/product consumers; static re-exports not applicable. |
| Helpers | `src/instruction-builder.ts`, `src/template-engine.ts`, `src/rule-evaluator.ts`, `src/processor-graph-hydrator.ts`, `src/snapshots-match.ts` | prompt rendering, conditional rules, processor graph hydration, snapshot comparison | Unit/package tests plus INV-007 and agent/prompt product scenarios. |
| Namespace base | `src/namespaces/base.ts` | CRUD namespace cache semantics, registration checks, version/status cache bypass | Editor invariant via namespace scenario consumers; product effects covered by CRUD/version workflows. |
| Agent namespace | `src/namespaces/agent.ts` | stored agent CRUD, builder defaults, source/code overrides, conditional resolvers, runtime registration, invalidation | INV-001/002/003/010 plus BUILDER/AGENT-CMS rows. |
| Prompt namespace | `src/namespaces/prompt.ts` | prompt block CRUD, rules, preview, versions | INV-007 plus PROMPT rows. |
| MCP namespace | `src/namespaces/mcp.ts`, `src/namespaces/mcp-server.ts` | stored MCP clients, runtime MCP server discovery, tools | INV-005/006 plus MCP rows. |
| Scorer namespace | `src/namespaces/scorer.ts` | scorer CRUD, versions, runtime resolution/cache clearing | INV-008 plus SCORER rows. |
| Skill namespace | `src/namespaces/skill.ts` | skill CRUD/copy/publish/favorites/files/assets, dependent invalidation | INV-009 plus SKILL rows. |
| Workspace namespace | `src/namespaces/workspace.ts` | stored workspace CRUD, runtime workspace snapshots/refs | INV-011 plus WORKSPACE rows. |
| Favorites namespace | `src/namespaces/favorites.ts` | resource favorite/unfavorite/filtering | INV-004 plus BUILDER-003/SKILL-005. |
| Tests and fixtures | `src/**/*.test.ts`, `src/e2e-scenarios/*` | package behavior proof | Treated as package/runtime invariants, not product-suite replacement. |

## Deferred strengthening / blocked route seams

Every product scenario row above maps to passing product-level proof, a runtime/server proof layer that is the correct boundary for the behavior, or an explicit blocked reason. These follow-ups are optional strengthening work, not uncovered product scenarios:

1. Refactor legacy builder route/component tests that still rely on local `vi.mock` seams so they can be counted as PR 18342 no-mock route proof.
2. Add full route-mounted Agent CMS tests if stable routing/test seams are added for instruction-block preview, MCP client editing, memory, variables, workspace, and browser sections; current coverage asserts those behaviors through product form payloads and runtime invariants.
3. Add a stored MCP client Playground mutation/page seam when the product wires `mcp-client-create-content.tsx` to `/api/stored/mcp-clients`; until then, server contract tests are the correct proof layer.
4. Add workspace page visual assertions for `runtimeRegistered` badges and file/skill browse presentation if that UI diverges from the typed workspace data hooks.
5. Add builder-specific RBAC route tests if builder gates diverge from the shared route-permission gate and server permission contracts.
