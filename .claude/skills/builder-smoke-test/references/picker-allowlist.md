# Picker Allowlists (Tools / Agents / Workflows)

The builder's `features.agent.tools|agents|workflows` flags + per-feature allowlists determine which entities appear in agent picker dropdowns. See PR #16025.

## Source-of-truth

`features.agent.tools = true` means tools can be attached. If a `pickerAllowlist` is configured per surface, only entries on the list appear. With no allowlist, all registered tools/agents/workflows are visible (subject to feature flag).

Settings payload exposes resolved allowlists at top level as `visibleTools` / `visibleAgents` / `visibleWorkflows` (each is `string[] | null`; `null` = unrestricted). Stored-agent records use different keys (`tools` / `agents` / `workflows`), so cross-check both shapes when validating.

## Steps

### 1. Confirm features enabled

```bash
curl -s "$BASE/editor/builder/settings" | jq '.features // .agent.features'
```

- [ ] `tools`, `agents`, `workflows`, `skills`, `model`, `browser`, `stars` all `true`
      (matches the scaffolded project's builder config)

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
