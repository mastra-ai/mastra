# Setup

Verify the `examples/agent` dev server is running and the builder is configured correctly.

## Steps

### 0. Preflight — env vars + mode

Before starting the server, run preflight with the auth mode this prompt
expects (`off` for Prompts 1–6, `on` for Prompt 7). Preflight is
detect-only and exits non-zero on missing vars, mode mismatch, or a
shell/`.env` collision on `AUTH_PROVIDER`.

```bash
# Most prompts (auth-off):
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off

# Prompt 7 only (auth-on, WorkOS):
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect on
```

Why `.env` matters more than your shell: `mastra dev` reads
`examples/agent/.env` via dotenv and **overwrites `process.env`** with the
loaded values (see `packages/cli/src/commands/dev/dev.ts` around line 384).
That means:

- Inline overrides on the command line are silently clobbered.
- Shell-only vars survive only if `.env` has no entry for the same key.
- The auth mode the server actually runs in is determined by `.env` alone.

Required for every prompt:

- `OPENAI_API_KEY` — `examples/agent` instantiates `OpenAIVoice` at module
  load. Without a key the server crashes during bundle init, before HTTP
  ever opens, with: `Error: No API key provided for speech model` from
  `voice/openai/dist/index.js`. Prefer setting it in `examples/agent/.env`
  so it definitely reaches the server.

Required for Prompt 7 (auth-on) only:

- `AUTH_PROVIDER=workos` in `examples/agent/.env`.
- `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_ORGANIZATION_ID` in `.env`.

If preflight reports any failure on an existing `.env`, **do not edit it
without explicit user say-so**. Surface the diagnosis, ask whether they'll
edit `.env` themselves or want you to do it. Restart `mastra dev` after
any `.env` change. If `examples/agent/.env` doesn't exist at all, you may
create it; still ask the user to dictate values rather than guessing.

### 1. Zombie port check

`mastra dev` auto-increments past `:4111` if it's busy (`:4112`, `:4113`…).
If you don't catch this, every subsequent `curl` hits the wrong server.

```bash
lsof -i :4111
# If a node/mastra process is listening from an earlier session, kill it:
kill $(lsof -ti :4111) 2>/dev/null || true
```

### 2. Start the dev server

`examples/agent/package.json` has **no `dev` script**. Use `mastra:dev`
(server only) or `dev:ui` (server + playground). For smoke tests, prefer
`mastra:dev` and use whichever browser tool the harness has wired up.

```bash
cd examples/agent
pnpm mastra:dev
```

### 3. Wait for readiness

The SPA shell at `/` can 200 before the API is mounted. Probe `/api/agents`
instead — `wait-for-server.sh` handles this and also detects the
port-bumped case.

```bash
bash .claude/skills/builder-smoke-test/scripts/wait-for-server.sh
```

If it reports the server is on `:4112`+ instead of `:4111`, stop, free the
port, and restart — running on a non-default port will silently break the
rest of the smoke (every curl in every reference assumes `:4111`).

### 4. Builder settings

```bash
curl -s $BASE/editor/builder/settings | jq .
```

**Verify:**

- [ ] Response contains `configuration.agent.workspace` with `type: "id"` and a `workspaceId`
- [ ] Response contains `features.agent.skills: true` (the `features` block is namespaced under `agent` — there is no top-level `features.skills`)
- [ ] Response contains **both** `configuration.agent.models.{allowed,default}` and a top-level `modelPolicy.{active, pickerVisible, allowed, default}`. They mirror each other; Model Policy assertions later in the suite key off `modelPolicy` specifically.

Record the `workspaceId` — this is the **builder workspace ID** used in all subsequent tests.

### 5. Baseline state

Record what already exists:

List endpoints return a paginated envelope: `{ hasMore, page, perPage, total, workspaces|agents|skills }`. The arrays live under the named key; use `.<key> | length` for the page count and `.total` for the full count.

```bash
# Workspaces
curl -s $BASE/stored/workspaces | jq '{ page: (.workspaces | length), total: .total }'

# Agents
curl -s $BASE/stored/agents | jq '{ page: (.agents | length), total: .total }'

# Skills
curl -s $BASE/stored/skills | jq '{ page: (.skills | length), total: .total }'
```

Note these counts — they help distinguish pre-existing entities from test-created ones.

### 6. Builder workspace exists

Resolve the builder workspace ID first (it's whatever is registered via the editor builder config — typically the only workspace with `metadata.source = "builder"`):

```bash
WORKSPACE_ID=$(curl -s $BASE/stored/workspaces | jq -r '.workspaces[] | select(.metadata.source == "builder") | .id' | head -1)
echo "WORKSPACE_ID=$WORKSPACE_ID"
curl -s $BASE/stored/workspaces/$WORKSPACE_ID | jq .
```

**Verify on the detail GET:**

- [ ] Workspace exists in DB (not 404)
- [ ] `metadata.source` is `"builder"`
- [ ] `status` is `"draft"` or `"active"` (boot leaves the builder workspace in `"draft"`; treat that as expected)
- [ ] `filesystem.provider` and `filesystem.config.basePath` are present
- [ ] Detail GET also returns `filesystem.config.contained: true`, a `sandbox` block (e.g. `{ provider: "daytona", config: {} }`), and a `resolvedVersionId` UUID — these are informational, not assertions, but worth recording.

> `runtimeRegistered` is **list-only**: it appears on entries of `GET /stored/workspaces` but is **not** included on the detail response above. Verify it via the list:
> ```bash
> curl -s $BASE/stored/workspaces | jq '.workspaces[] | select(.id == "'"$WORKSPACE_ID"'") | .runtimeRegistered'
> # → true
> ```

If the workspace doesn't exist yet, it means `ensureBuilderWorkspaces()` hasn't run — check that the `Workspace` instance is registered in the Mastra constructor in `examples/agent/src/mastra/index.ts`.

## Checklist

- [ ] Preflight passes for the expected mode (`--expect off` or `--expect on`)
- [ ] Port `:4111` is free, or the zombie has been killed
- [ ] Server started with `pnpm mastra:dev` after the most recent `.env` edit
- [ ] `wait-for-server.sh` reports ready on `:4111` (not `:4112`+)
- [ ] Builder settings endpoint returns valid config (`features.agent.skills: true`, both `configuration.agent.models` and `modelPolicy` present)
- [ ] Builder workspace exists in DB with correct metadata (and `runtimeRegistered: true` on the list response)
- [ ] Baseline entity counts recorded from `{ page, total }` shape
