# Model Policy

The builder's `configuration.agent.models.allowed` array constrains which models can be used. The `models.default` entry seeds new agents. Studio + Agent Builder dropdowns must respect the allowlist.

> **Two shapes, same concept.** Builder _config_ (TypeScript, the scaffolded project's `src/mastra/index.ts`) uses `{ provider, modelId }`. Stored-agents _API_ (`POST /stored/agents`, schema in `packages/server/src/server/schemas/stored-agents.ts`) uses `{ provider, name }`. When you POST to create an agent, use `name`. When you read the policy from the settings endpoint or the TS source, you'll see `modelId`.

> **Non-admin runs.** The scaffold grants `member` write on stored agents, so the create-time policy checks (steps 2–4) are reachable from `--role member`. `viewer` gets 403 before policy validation runs — for viewer, only step 1 (read-side) is meaningful; the UI dropdown gating in `references/ui.md` is the alternative path for viewer model-policy verification.

## Source-of-truth

In the scaffolded project's `src/mastra/index.ts`:

```ts
models: {
  allowed: [
    { provider: 'openai' },                                  // wildcard: any openai model
    { provider: 'anthropic', modelId: 'claude-opus-4-7' },   // exact: only this anthropic model
  ],
  default: { provider: 'openai', modelId: 'gpt-5.4' },
}
```

## Steps

> **Capability gate:** Steps 2–4 require `stored-agents:write`. For `--role viewer`, skip them and rely on the UI dropdown check in `references/ui.md`. For `--role admin` and `--role member`, run them all (the scaffold grants member that perm).

### 1. Settings exposes the policy

```bash
curl -s "$BASE/editor/builder/settings" | jq '.configuration.agent.models'
```

- [ ] `allowed` is an array with the two entries above
- [ ] `default` matches `{ provider: 'openai', modelId: 'gpt-5.4' }`

### 2. Create with an allowed wildcard model

```bash
curl -s -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Policy OK Agent",
    "instructions": "test",
    "model": { "provider": "openai", "name": "gpt-4o-mini" }
  }' | jq .
```

- [ ] 200; `model.name` is `gpt-4o-mini` (allowed via wildcard)

### 3. Create with the allowed exact model

```bash
curl -s -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Policy Exact Agent",
    "instructions": "test",
    "model": { "provider": "anthropic", "name": "claude-opus-4-7" }
  }' | jq .
```

- [ ] 200; model accepted

### 4. Create with a disallowed model

```bash
curl -s -o /tmp/policy-err.json -w '%{http_code}\n' \
  -X POST "$BASE/stored/agents" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Policy Reject Agent",
    "instructions": "test",
    "model": { "provider": "anthropic", "name": "claude-haiku-3" }
  }'
cat /tmp/policy-err.json | jq .
```

- [ ] Returns `422` (semantic validation error) with a clear "model not in allowed list" message
- [ ] No agent was created (list count unchanged)

### 5. Browser dropdown respects the policy

In Studio (`/agents`) and Agent Builder (`/agent-builder/agents/:id`) model dropdowns:

- [ ] All OpenAI models appear (wildcard expansion)
- [ ] Only `claude-opus-4-7` appears under Anthropic
- [ ] No other Anthropic models appear
- [ ] No other providers (Google, Mistral, etc.) appear

### 6. Default model is pre-selected on create

In the agent-create form:

- [ ] Model dropdown shows `openai / gpt-5.4` selected by default
- [ ] User can change to any allowed alternative

## Cleanup

```bash
# remove any agents created above
```

## Checklist

- [ ] Settings exposes `allowed` + `default`
- [ ] Wildcard provider allows any model
- [ ] Exact `(provider, modelId)` policy entry restricts to that model on create
- [ ] Disallowed model rejected at create
- [ ] UI dropdown reflects allowlist exactly
- [ ] Default model pre-selected on agent create
