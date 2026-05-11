# Setup

Verify the examples/agent dev server is running and the builder is configured correctly.

## Steps

### 1. Server Health Check

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:4111
# Expected: 200
```

If not 200, start the server:

```bash
cd examples/agent
pnpm dev
```

Wait for readiness (poll until 200):

```bash
for i in {1..60}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4111 || true)
  [ "$code" = "200" ] && echo "Ready" && break
  sleep 1
done
```

### 2. Builder Settings

```bash
curl -s http://localhost:4111/api/editor/builder/settings | jq .
```

**Verify:**
- [ ] Response contains `configuration.agent.workspace` with `type: "id"` and a `workspaceId`
- [ ] Response contains `features` object (check for `skills: true`)
- [ ] Response contains `models` or `modelPolicy` (allowed providers/models)

Record the `workspaceId` — this is the **builder workspace ID** used in all subsequent tests.

### 3. Baseline State

Record what already exists:

```bash
# Workspaces
curl -s http://localhost:4111/api/stored/workspaces | jq '.workspaces | length'

# Agents
curl -s http://localhost:4111/api/stored/agents | jq '.agents | length'

# Skills
curl -s http://localhost:4111/api/stored/skills | jq '.skills | length'
```

Note these counts — they help distinguish pre-existing entities from test-created ones.

### 4. Builder Workspace Exists

```bash
curl -s http://localhost:4111/api/stored/workspaces/<workspaceId> | jq .
```

**Verify:**
- [ ] Workspace exists in DB (not 404)
- [ ] `metadata.source` is `"builder"`
- [ ] `runtimeRegistered` is `true`
- [ ] `status` is `"draft"` or `"active"`
- [ ] `filesystem` config is present (has `provider` and `config.basePath`)

If the workspace doesn't exist yet, it means `ensureBuilderWorkspaces()` hasn't run — check that the `Workspace` instance is registered in the Mastra constructor in `examples/agent/src/mastra/index.ts`.

## Checklist

- [ ] Server responds 200
- [ ] Builder settings endpoint returns valid config
- [ ] Builder workspace exists in DB with correct metadata
- [ ] Baseline entity counts recorded
