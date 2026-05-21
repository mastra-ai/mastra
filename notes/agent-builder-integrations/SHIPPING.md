# v1 ToolProvider extensions — shipping summary

Consolidated record of what shipped, why, and how. Supersedes the per-phase
planning notes that lived in this folder during the build-out.

---

## What shipped

Multi-tenant, multi-connection support for `ToolProvider` (Composio) wired
through core → storage → server → client-js → playground UI, on top of the
existing `magnificent-marquess` branch.

End-to-end capabilities now live on `yj/mm/v1-tool-provider-extensions`:

- **Per-pin connection scope.** Every pinned connection on an agent carries
  `scope: 'per-author' | 'shared' | 'caller-supplied'`. Scope decides which
  bucket the runtime resolves the connection against:
  - `per-author` → `storedAgent.authorId` (Agent Builder default)
  - `shared` → `SHARED_BUCKET_ID` constant
  - `caller-supplied` → `requestContext[MASTRA_RESOURCE_ID_KEY]`, falling
    back to a shared `'default'` bucket when the host app has not wired
    `mapUserToResourceId` (matches legacy `ComposioToolProvider` behavior)
- **Persisted connections with labels.** New `mastra_tool_integration_connections`
  table backs a per-author registry of `{providerId, connectionId, toolkit,
  label, scope}`. Labels are required at connection creation.
- **Studio Connections UI.** Inline `ConnectionPicker` per toolkit:
  authorize OAuth, list existing connections, pin/unpin, reauthorize,
  disconnect everywhere, delete failed. Renders dynamic pre-auth fields
  driven by the provider (`listConnectionFields`).
- **Hybrid Tools/Connections tabs.** Composio tools appear as
  `type: 'integration'` rows in the **Tools** tab (alongside native tools),
  with a "Set up connection" affordance that deep-links into the
  **Connections** tab when no connection is pinned. Auth lives only on the
  Connections tab.
- **Surface-locked scope per surface.** Agent Builder pins are hard-locked
  to `per-author`; CMS agent editor pins are hard-locked to
  `caller-supplied` (sentinel connection auto-stamped on mount). The
  user-facing visibility radio was removed in favor of a required `scope`
  prop on `ConnectionPicker` / `ToolProvidersSection`.
- **Surface-scoped model policy.** The previously global builder
  `modelPolicy` no longer leaks into the CMS editor. Server resolver
  `resolveModelPolicy({ editor, surface })` returns the right allowlist per
  surface, and the playground exposes a `ModelPolicyProvider surface="…"`
  context.
- **Agent Builder writes `toolProviders`.** `setAgentTools` client tool
  routes integration entries through `routeToolInputToFormKeys` into a
  `toolProvidersFragment` and shallow-merges into the form; the builder
  tool itself is gated on `useAllProviderTools().isLoading` so the LLM
  doesn't pick from an empty enum.
- **Runtime resolution in editor.** `createAgentFromStoredConfig` now
  resolves `toolProviders` via `resolveStoredToolProviders` in both the
  dynamic and static tool branches, on both Builder and Editor surfaces.

---

## How we shipped it

### Base branch

Built on `yj/magnificent-marquess` (has agent-builder + RBAC + channels;
`main` lacks them). All work is **additive**: existing `ToolProvider`
methods kept their signatures, every new method on the interface is
optional, and `capabilities` is an optional field so legacy adapters
compile unchanged. `BaseToolProvider` bridges legacy `listToolkits` /
`listTools` / `resolveTools` into the v2 envelopes.

Vocabulary stayed marquess-native: `toolkit` everywhere (not
`toolService`). The previously archived `ToolIntegration` rename was
abandoned.

### Phasing

1. **Core types + runtime.** Extended `ToolProvider` interface with v2
   methods + capabilities; added `tool-provider/runtime.ts` resolver,
   `ToolProviderConnectionScope`, `StorageToolProviderConfig`, and a
   `BaseToolProvider` adapter bridge.
2. **Storage.** New `mastra_tool_integration_connections` table + domain
   under `packages/core/src/storage/domains/tool-provider-connections/`,
   plus libsql, clickhouse, cloudflare adapter wiring. `toolProviders` is
   an optional column on agent version snapshots — existing agents
   ignore it.
3. **Server.** New handlers under
   `packages/server/src/server/handlers/tool-providers.ts` (list/get/
   authorize/disconnect/health/fields), schema in
   `tool-providers.ts`, route registration in
   `server-adapter/routes/tool-providers.ts`. Added `toolProviders` to
   `AGENT_SNAPSHOT_CONFIG_FIELDS`. Surface-scoped model-policy resolver
   replaces the old builder-specific one.
4. **Client-js.** Extended `client.toolProviders` resource with the new
   methods; route types regenerated.
5. **Composio adapter.** `ComposioToolProvider` ported to implement the
   full v2 surface (`resolveToolsV2`, `authorize`, `listConnectionFields`,
   `listConnections`, `getConnectionStatus`, `revokeConnection`,
   `getHealth`). Capabilities flagged
   `multipleConnectionsPerToolkit: true`.
6. **Playground UI.** `tool-providers` domain rewritten: deleted the
   legacy modal/browse UX (`toolkit-list`, `tool-list`,
   `integration-tools-section`, `tool-provider-dialog`,
   `selected-tool-list`, `use-provider-tools`) and replaced with inline
   `ConnectionPicker` + `ToolProvidersSection` + health pill + connection
   lifecycle UX.
7. **Editor runtime hydration.** Wired
   `resolveStoredToolProviders(toolProviders, lookup, { requestContext,
   authorId, logger })` into both branches of
   `createAgentFromStoredConfig`. Forced the dynamic branch whenever
   `toolProviders` are present so requestContext is plumbed.
8. **Agent Builder integration.** Hybrid Tools/Connections tab; new
   `useToolProvidersBridge` + integration row in the Tools list; routing
   of integration entries through `set-agent-tools-tool`; loading-gate on
   the builder tool.

### Things we tried and rejected

- **Greenfield rename to `ToolIntegration`.** Looked clean (~−500 LOC
  estimate) but doubled the surface during transition. Reverted in favor
  of extending the existing `ToolProvider` interface — zero renames on
  the working branch.
- **Permissive throw for `caller-supplied`.** First pass threw
  `CALLER_SUPPLIED_USER_ID_MISSING` when `requestContext` was missing the
  resource id. Broke the CMS editor chat for hosts that hadn't wired
  `authConfig.mapUserToResourceId`. Restored the legacy fallback to the
  shared `'default'` bucket; multi-tenant hosts should still wire the
  mapper explicitly.
- **Cross-author "Mine/All" admin filter in the picker.** Implemented
  then removed — cross-author admin view belongs on a future global
  admin connections page, not on the per-agent picker.
- **Visibility radio (per-author / shared / caller-supplied) in the
  picker.** Implemented then removed once surfaces became hard-locked to
  a single scope. Picker now takes a required `scope` prop.

---

## Verification

- Server tests: 1681 pass / 4 skip / 1 todo
- Playground `tool-providers` UI tests: 50/50 pass (connection-picker
  38, health-pill 6, use-agent-health 6)
- Editor tests (Composio adapter): 500 pass
- LibSQL adapter tests: 16 pass
- `@mastra/core` tests: 8394 pass (one known-flaky `evented-workflow`
  `beforeEach` timeout, passes in isolation)
- Builds clean: `@mastra/core`, `@mastra/editor`, `@mastra/server`,
  `@mastra/client-js`, `@internal/playground`

### Interactive scenarios still owned by humans

- OAuth happy-path against a real Composio account (Gmail, Slack)
- Multi-author admin view of cross-author connections (deferred to
  global admin page)
- CMS editor `caller-supplied` end-to-end with a host that wires
  `mapUserToResourceId` (verified by automated tests; manual sign-off
  pending)

---

## Multi-tenant deployment cheat sheet

Use `caller-supplied` when end users own the credentials.

| Scope | Bucket | Use when |
|---|---|---|
| `per-author` (builder default) | agent `authorId` | The agent author owns the credentials |
| `shared` | `SHARED_BUCKET_ID` | A team of editors share one OAuth account |
| `caller-supplied` (CMS default) | `ctx[MASTRA_RESOURCE_ID_KEY]` or `'default'` | End user owns their own credentials; host app injects the ID |

Wire `authConfig.mapUserToResourceId` on the host app so the runtime can
bucket `caller-supplied` connections per end user — otherwise all
end users share the `'default'` bucket.

Mixed scopes per agent are first-class (e.g. Gmail `caller-supplied`,
Slack `shared` on the same agent).
