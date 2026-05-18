# Phase 4 — Builder UI (toolkit picker, account picker, tool picker)

> Parent RFC: [`../composio-research.md`](../composio-research.md) — see "DISCOVERY (rev 3)".
> Previous phase: [Phase 3 — Storage + Connect Link Lifecycle](./phase-3-connections.md)
> Next phase: [Phase 5 — Runtime Tool Execution](./phase-5-runtime.md)

> **Rev 3 delta**: existing playground integration-tools UI (`integration-tools-section.tsx`, `tool-provider-dialog.tsx`, `toolkit-list.tsx`, `use-toolkits.ts`, etc.) already covers picker UX for any `ToolProvider`. Phase 4 either (a) extends those components to honor the gated builder catalog + connection picker, or (b) forks a builder-only variant. **Lean (a)** — extend existing components, swap the data source to the gated builder routes, layer the `connectedAccountId` picker on top.

> **Rev 4 delta** (after Phase 3 shipped):
> - **Binding shape is plural.** `integrationTools.composio` now carries `connectionsByToolkit: Record<toolkitSlug, connectedAccountId>` (not a single `connectedAccountId`). One agent can pin different toolkits to different accounts.
> - **Connection routes already shipped.** Phase 3 added `GET/POST/DELETE /editor/builder/composio/connections[/:id]` (gated by `composio:read|write|delete`). Phase 4 only needs to call them.
> - **Settings exposure decision:** extend `GET /editor/builder/settings` with `registries.composio: { enabled, allowedToolkits }`. **Never** expose `apiKey`, `platformUserId`, or `authConfigs`.
> - **builderAgent refusal E2E** moves to Phase 5 (runtime is what actually decides whether tools resolve).

> **Rev 5 delta — chat-only scope**:
> - The Composio surface in the builder is **chat-driven**, not a CMS form panel. Authors talk to `builderAgent`, which calls `agentBuilderTool` (extended with a `composio` field) to mutate the form, and a side-effect `connectComposioTool` to open the Connect Link modal.
> - The CMS Tools page (`/cms/agents/<id>/tools`) is NOT touched in Phase 4. The `ComposioToolsSection` panel that was prototyped has been removed.
> - The builder edit form (`AgentBuilderEditFormSchema`) gains `integrationTools` + `connectionsByToolkit` so that the chat-driven flow can hydrate, mutate, and persist Composio bindings.
> - `connectComposioTool` opens the existing `ConnectLinkModal` via a state-bridge (`useComposioConnectBridge`) and returns `{ ok, connectedAccountId }` to the agent.
> - `builderAgent` instructions are extended with a "Composio integrations" section that explains the two-step flow (`connectComposioTool` → `agentBuilderTool({ composio })`).

> **Rev 6 delta — dedicated configure-panel section (stepping stone)**:
> - Chat-driven is fast for power users but invisible — authors can't see what's attached without asking the agent. Adds a **dedicated Composio section** to the builder configure panel (right side of `/agent-builder/agents/<id>`) so manual selection + visibility work without chatting.
> - Section reads/writes the same form state (`integrationTools`, `connectionsByToolkit`) that the chat-driven flow uses. Last-write-wins between chat and manual.
> - Reuses Phase 3/4 hooks (`useComposioToolkits`, `useComposioTools`, `useComposioConnections`, `useComposioConnectBridge`).
> - **This is a stepping stone, not the long-term shape.** See "Future: Unified tools picker" below.

> **Future — Unified tools picker (vNext)**:
> - End state: no separate "Composio" panel in the UI. Composio tools merge into the existing tools picker alongside native tools / agents / workflows.
> - Tool IDs adopt a `composio:<toolkit>:<toolSlug>` convention so they fit the existing `Record<id, true>` form shape.
> - Checking a Composio tool inline triggers the Connect Link modal automatically when no connection exists.
> - Storage stays `integrationTools.composio` for now — runtime (Phase 5) already reads it.
> - Builder agent description drops the separate "Available Composio toolkits" block once unification ships.
> - Rationale: the dedicated panel is a fast win, but the long-term mental model is "tools are tools" — provider is an implementation detail.

## Goal

Author can browse Composio toolkits in the builder UI, pick an existing connection (or initiate a new Connect Link inline), select specific tools, and save the agent. Form mutation flows through the existing `agentBuilderTool` client tool — the `builderAgent` cannot bypass the picker.

## Background

- **Why this phase is ordered here**: the first user-visible phase. All server surface (Phases 1–3) is in place; this phase wires it to React.
- Parent RFC sections to re-read:
  - "FLOWS → Builder: add Composio tool to an agent"
  - "MULTI-ACCOUNT PER TOOLKIT → Builder UX"
  - "V1 REQUIREMENTS (recap)" requirement #5 — builder agent cannot execute Composio tools.
- Inherited blockers: Phase 3 routes (catalog, connections) must be deployed. Connect Link callback flow assumes Studio is the redirect target.
- React + Tailwind: follow `react-best-practices` and `tailwind-best-practices` skills. **This phase requires E2E tests** — invoke `e2e-tests-studio` skill before completion.

## Scope

### Playground UI components
- `packages/playground-ui/src/domains/agent-builder/integrations/composio/toolkit-picker.tsx` — grid/list of allowed toolkits with search.
- `packages/playground-ui/src/domains/agent-builder/integrations/composio/account-picker.tsx` — for a selected toolkit, show existing connections (label + status) + "Connect new account" button.
- `packages/playground-ui/src/domains/agent-builder/integrations/composio/tool-picker.tsx` — tool list within a toolkit, multi-select.
- `packages/playground-ui/src/domains/agent-builder/integrations/composio/connect-link-modal.tsx` — popup window opener; polls `GET /connections/:id` until `ACTIVE`.
- `packages/playground-ui/src/domains/agent-builder/integrations/composio/index.tsx` — composes the three pickers into a flow inserted into the agent edit form.

### Hooks
- `packages/playground-ui/src/domains/agent-builder/hooks/use-composio-catalog.ts` — `useToolkits()`, `useTools(toolkitSlug)`. Backed by react-query.
- `packages/playground-ui/src/domains/agent-builder/hooks/use-composio-connections.ts` — `useConnections(toolkitSlug)`, `useInitiateConnection()`, `useRevokeConnection()`.
- `packages/playground/src/ee/use-composio-enabled.ts` — reads `useBuilderSettings()` and returns whether the Composio surface should render.

### Settings exposure
- `packages/server/src/server/handlers/editor-builder.ts` — extend `GET /editor/builder/settings` response with `registries.composio: { enabled, allowedToolkits, authConfigToolkits? }`. **Never expose `apiKey`, `platformUserId`, or `authConfigs` values**. `authConfigToolkits` is the list of toolkit slugs that have an `authConfigId` pinned (boolean-ish info, no IDs), so the UI can decide whether to enable the "Connect new account" button per-toolkit.
- `packages/core/src/agent-builder/ee/index.ts` — add a `toPublicComposioRegistry(registry: ResolvedComposioRegistry)` helper that returns `{ enabled: true, allowedToolkits, authConfigToolkits }` or `{ enabled: false }`. Unit-test this helper to lock the redaction contract.
- Update `builderSettingsResponseSchema` in `packages/server/src/server/handlers/editor-builder.ts` to include the new `registries.composio` shape. Regenerate generated route metadata as a side-effect.

### Agent edit form + builderAgent
- Wire Composio picker into the existing agent edit form alongside Mastra tools (same picker surface, grouped section per parent RFC's "OPEN QUESTIONS" decision).
- `agentBuilderTool` client tool schema — extend the existing `integrationTools` slot so the Composio entry carries:
  ```ts
  integrationTools: {
    composio: {
      tools: { [toolSlug]: StorageToolConfig },
      connectionsByToolkit?: { [toolkitSlug]: connectedAccountId },
    },
  }
  ```
  **Do not** invent a parallel `composioBindings` field. **Do not** use a singular `connectedAccountId` — that key was retired in Phase 3.
- The form must group selected tools by toolkit slug to derive `connectionsByToolkit` keys correctly. Tools whose toolkit has no selected account in `connectionsByToolkit` resolve at runtime via Composio's default account selection (Phase 5).
- `packages/editor/src/ee/agent-builder-agent.ts` — extend instructions with a short "Composio capabilities" note. **Do not** grant `builderAgent` direct access to Composio SDK.

### Tests
- Unit tests for each picker component (RTL).
- Hook tests for catalog + connections (mocked fetch). Assert hooks use the gated routes (`/api/editor/builder/composio/*`), not the ungated `/api/tool-providers/*`.
- Unit test for `toPublicComposioRegistry` redaction (no `apiKey`, no `platformUserId`, no `authConfigs` values in output).
- **E2E test (required)**: Playwright spec that opens the builder, picks gmail toolkit, picks an existing pre-seeded connection, picks two tools, saves agent, and asserts the stored agent's `integrationTools.composio` slot has `{ tools: { GMAIL_SEND_EMAIL: ..., GMAIL_FETCH_EMAILS: ... }, connectionsByToolkit: { gmail: 'ca_xxx' } }`.
- E2E for Connect Link new-account flow against a mocked OAuth provider. Asserts the POST `/connections` returns a `redirectUrl`, popup opens, polling `GET /connections/:id` resolves to `ACTIVE`, and the account appears in the picker.

**Explicitly NOT touched**: runtime tool resolution (Phase 5), admin observability surface (Phase 6), connection RBAC.

## Acceptance truths

- [ ] Composio section is hidden when `registries.composio.enabled !== true`.
- [ ] Toolkit picker renders only the toolkits returned by `GET /composio/toolkits`.
- [ ] Tool picker renders only the tools returned by `GET /composio/toolkits/:slug/tools`.
- [ ] Account picker shows all `ACTIVE` connections for the selected toolkit, plus a "Connect new account" CTA.
- [ ] "Connect new account" opens Composio's Connect Link in a popup/new tab, polls status, closes on `ACTIVE`, and refreshes the account list.
- [ ] Saving an agent with Composio bindings writes the agent's `integrationTools.composio` slot with `{ tools, connectionsByToolkit }` (no new table, plural key).
- [ ] `builderAgent` cannot invoke Composio tools — confirmed by absence of Composio tools in its `tools` array. (Runtime refusal is verified in Phase 5.)
- [ ] `GET /editor/builder/settings` does **not** include `apiKey`, `platformUserId`, or any `authConfigId` values in any response. Only `enabled`, `allowedToolkits`, and `authConfigToolkits` (slug list) may surface.
- [ ] All Playwright E2E specs pass under `pnpm --filter @mastra/playground test:e2e`.

## Verification step

```
pnpm --filter @mastra/playground-ui build && pnpm --filter @mastra/playground-ui test
pnpm --filter @mastra/playground build && pnpm --filter @mastra/playground test
pnpm --filter @mastra/playground-ui tsc --noEmit
pnpm --filter @mastra/playground tsc --noEmit
pnpm --filter @mastra/playground test:e2e -- composio
```

All must pass. Manual smoke (use `smoke-test` skill): create a Mastra project, configure `registries.composio`, build an agent with gmail tools in Studio, verify DB state.

## Handoff to next phase

- Canonical Composio binding shape lives in `integrationTools.composio`: `{ tools: { [toolSlug]: StorageToolConfig }, connectionsByToolkit?: { [toolkitSlug]: connectedAccountId } }`. Phase 5 reads `connectionsByToolkit` verbatim and forwards it through `ResolveToolProviderToolsOptions.connectionsByToolkit` to `ComposioToolProvider.resolveTools`.
- `GET /editor/builder/settings` is now the public surface for client gating; Phase 5 may extend it with additional flags only if absolutely needed.
- `builderAgent` instructions updated; if Phase 5 changes runtime behavior, re-validate that the agent still refuses to execute Composio tools.
- Follow-up backlog: account labels (Phase 6), bulk-delete bindings, drag-reorder tools.
