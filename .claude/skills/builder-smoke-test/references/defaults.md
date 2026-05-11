# Builder Defaults on Agent Create

When the Agent Builder is enabled, `applyBuilderDefaults()` fills in workspace, memory, browser, and model on stored-agent create — but only for fields the caller did **not** explicitly set. Explicit `null` is preserved as "no default" (opt-out).

Reference: `packages/core/src/agent-builder/ee/apply-builder-defaults.ts` and `examples/agent/src/mastra/index.ts` (the `builder.configuration.agent` block).

## Source-of-truth: builder config in `examples/agent`

```ts
builder: {
  configuration: {
    agent: {
      workspace: { type: 'id', workspaceId: 'builder-workspace' },
      memory:    { options: { lastMessages: 10 } },
      browser:   { type: 'inline', config: { provider: 'stagehand' } },
      models: {
        allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }],
        default: { provider: 'openai', modelId: 'gpt-5.4' },
      },
    },
  },
}
```

## Steps

### 1. Create an agent with no overrides

```bash
RESP=$(curl -s -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Defaults Smoke Agent", "instructions": "Smoke test for builder defaults.", "visibility": "private" }')
echo "$RESP" | jq .
AGENT_ID=$(echo "$RESP" | jq -r '.id // .agent.id')
```

Verify the response (or a follow-up `GET /stored/agents/$AGENT_ID`):

- [ ] `workspaceId` is `"builder-workspace"` (from `workspace.type=id`)
- [ ] `model.provider` is `"openai"` and `model.name` is `"gpt-5.4"` (default model — API persists the config's `modelId` under the `name` field)
- [ ] `memory.options.lastMessages` is `10`
- [ ] `browser.config.provider` is `"stagehand"` (inline provider)
- [ ] `authorId` set (or undefined if auth is off)

### 2. Create an agent with explicit overrides

```bash
curl -s -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Overrides Smoke Agent",
    "instructions": "Smoke test for explicit overrides.",
    "model": { "provider": "anthropic", "name": "claude-opus-4-7" },
    "memory": { "options": { "lastMessages": 3 } },
    "visibility": "private"
  }' | jq .
```

- [ ] `model` matches the override (`anthropic / claude-opus-4-7`)
- [ ] `memory.options.lastMessages` is `3`, not `10`
- [ ] `workspaceId` is still the default builder workspace (not overridden)
- [ ] `browser` is still the default

### 3. Create an agent with explicit `null` to opt out

```bash
curl -s -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Null Opt-out Smoke Agent",
    "instructions": "Smoke test that explicit null preserves opt-out.",
    "browser": null,
    "memory": null,
    "visibility": "private"
  }' | jq .
```

- [ ] `browser` is `null` (default was NOT applied because caller set null)
- [ ] `memory` is `null`
- [ ] `model` still got the default
- [ ] `workspaceId` still got the default

### 4. Verify defaults expose via settings

```bash
curl -s "$BASE/editor/builder/settings" | jq '.agent // .builder.agent // .configuration.agent'
```

- [ ] `workspace`, `memory`, `browser`, `models.default`, `models.allowed` all appear

## Cleanup

```bash
curl -s -X DELETE "$BASE/stored/agents/$AGENT_ID" | jq .
# repeat for other agents created above
```

## Checklist

- [ ] Default workspace applied when caller omits
- [ ] Default model applied when caller omits
- [ ] Default memory applied when caller omits
- [ ] Default browser applied when caller omits
- [ ] Explicit fields are preserved (not overwritten)
- [ ] Explicit `null` preserves opt-out (default NOT applied)
- [ ] Settings endpoint exposes the configured defaults
