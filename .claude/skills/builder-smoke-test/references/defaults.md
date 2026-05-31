# Builder Defaults on Agent Create

When the Agent Builder is enabled, `applyBuilderDefaults()` fills in workspace, memory, browser, and model on stored-agent create — but only for fields the caller did **not** explicitly set. Explicit `null` is preserved as "no default" (opt-out).

Reference: `packages/core/src/agent-builder/ee/apply-builder-defaults.ts` and the scaffolded project's `src/mastra/index.ts` (the `builder.configuration.agent` block).

> **Visibility under `--auth off`.** Some examples below pass `"visibility": "private"`. With `--auth off` the server has no caller to attribute ownership to and forces `visibility: "public"` (and `authorId: null`) regardless of what you send. That is expected; don't fail the step on it. Under `--auth on`, `"private"` is preserved.

## Source-of-truth: builder config in the scaffolded project

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

- [ ] `workspace.workspaceId` is `"builder-workspace"` (nested under `workspace`, type=`"id"`)
- [ ] `model.provider` is `"openai"` and `model.name` is `"gpt-5.4"` (default model — API persists the config's `modelId` under the `name` field)
- [ ] `memory.options.lastMessages` is `10`
- [ ] `browser.config.provider` is `"stagehand"` (inline provider)
- [ ] `authorId` set (or `null` if auth is off)

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
- [ ] `workspace.workspaceId` is still the default builder workspace (not overridden)
- [ ] `browser` is still the default

### 3. Create an agent with explicit `null` to opt out (`browser` only)

`browser` accepts `null` (or `false`) to opt out of the default. `memory` and `workspace` schemas do NOT accept `null` — omit the field entirely to "opt out" (the default just won't apply for omitted fields anyway). Sending `memory: null` returns HTTP 400.

```bash
curl -s -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Null Opt-out Smoke Agent",
    "instructions": "Smoke test that explicit null preserves opt-out.",
    "browser": null,
    "visibility": "private"
  }' | jq .
```

- [ ] `browser` is `null` (default was NOT applied because caller set null)
- [ ] `memory` still got the default (caller omitted the field)
- [ ] `model` still got the default
- [ ] `workspace.workspaceId` still got the default

Verify the negative path:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Memory Null Smoke", "instructions": "x", "memory": null }'
```

- [ ] Status code is `400` (schema rejects `memory: null`)

### 4. Verify defaults expose via settings

```bash
curl -s "$BASE/editor/builder/settings" | jq '.configuration.agent'
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
- [ ] Explicit `null` on `browser` preserves opt-out (default NOT applied)
- [ ] Explicit `null` on `memory` returns HTTP 400 (schema does not allow null)
- [ ] Settings endpoint exposes the configured defaults
