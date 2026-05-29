# Picker Allowlists (Tools / Agents / Workflows)

The builder's `features.agent.tools|agents|workflows` flags + per-feature allowlists determine which entities appear in agent picker dropdowns. See PR #16025.

## Source-of-truth

`features.agent.tools = true` means tools can be attached. If a `pickerAllowlist` is configured per surface, only entries on the list appear. With no allowlist, all registered tools/agents/workflows are visible (subject to feature flag).

Settings payload exposes resolved allowlists nested under `.picker` as `picker.visibleTools` / `picker.visibleAgents` / `picker.visibleWorkflows` (each is `string[] | null`; `null` = unrestricted). They are NOT at the top level — `jq '.visibleTools'` returns `null` because the field doesn't exist there. Stored-agent records use different keys (`tools` / `agents` / `workflows`), so cross-check both shapes when validating.

> **Casing note.** The allowlist in `configuration.agent.{tools,agents,workflows}.allowed` accepts both registration-key form (`weatherInfo`) and entity-`.id` form (`weather-info` if the underlying tool sets `id: 'weather-info'`). The server resolves either to the canonical response key. So `allowed: ['weather-info']` and `allowed: ['weatherInfo']` are functionally equivalent — `visibleTools` will emit the registration key (`weatherInfo` for tools/workflows, `.id` for agents). This is **not** a bug; it's deliberate alias matching. See `packages/server/src/server/handlers/editor-builder.ts` `collectAliases`.

## Steps

### 1. Confirm features enabled

```bash
curl -s "$BASE/editor/builder/settings" | jq '.features.agent'
```

- [ ] `tools`, `agents`, `workflows`, `skills`, `model`, `browser`, `favorites`, `scorers`, `variables`, `avatarUpload`, `memory` all `true`
      (matches the scaffolded project's builder config — `favorites` replaces the legacy `stars` key after the rename)

### 1b. Confirm picker allowlists shape

```bash
curl -s "$BASE/editor/builder/settings" | jq '.picker'
```

- [ ] `visibleTools` is `string[]` (or `null` if unrestricted)
- [ ] `visibleAgents` is `string[]` and excludes `builder-agent`
- [ ] `visibleWorkflows` is `string[]`
- [ ] Tool/workflow keys use the registration form (camelCase, e.g., `weatherInfo`); agent keys use entity `.id` form (e.g., `weather-agent`)

### 2. Tool picker reflects registered tools

Open an agent in Builder (`/agent-builder/agents/<id>/view` or `/edit`), open the Tools picker.

- [ ] All non-internal tools registered on `mastra.tools` are visible
- [ ] Internal/system tools (e.g., `_internal_*`) are hidden

### 3. Agent picker reflects registered agents

Same agent, open the Sub-agents/Network picker.

- [ ] Stored agents from `mastra.agents` are visible
- [ ] The current agent itself is hidden (no self-reference)

### 4. Workflow picker reflects registered workflows

Same agent, open the Workflows picker.

- [ ] All workflows in `mastra.workflows` are visible
- [ ] Workflows without `inputSchema` either appear with a warning or are hidden — note which

### 5. Feature flag off hides picker entirely

If you have shell access to flip a feature flag temporarily, set `features.agent.tools = false`, restart, reload the agent. (Skip if you don't want to restart.)

- [ ] Tools picker is hidden / disabled
- [ ] Attempting to PATCH `{ tools: ["x"] }` returns 4xx

### 6. Allowlist (if configured)

If a `pickerAllowlist` is defined for a surface, only those entries appear.

- [ ] Visible entries are exactly the allowlist
- [ ] Removing an entry from the allowlist on restart removes it from the picker

(Skip if no allowlist is configured in the running example.)

## Checklist

- [ ] Features flags reflected in settings
- [ ] Tools picker shows registered tools, hides internals
- [ ] Agent picker shows registered agents, hides self
- [ ] Workflow picker shows registered workflows
- [ ] Feature flag off hides picker
- [ ] Allowlist (if any) is respected
