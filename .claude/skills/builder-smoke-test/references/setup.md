# Setup

Scaffold the hermetic project, start its dev server, and verify the Builder configuration is correct.

## Steps

### 0. Choose the project directory

Before scaffolding, decide where `$PROJECT_DIR` should live. Resolution order:

1. `--dir <path>` flag (highest priority)
2. `$BUILDER_SMOKE_TEST_DIR` env var
3. Default: `~/mastra-builder-smoke-tests/builder-smoke`

Ask the user where they want the scaffolded project to live, offering the
default as the suggestion. Example:

> I'll scaffold a hermetic project for the smoke test. Default location is
> `~/mastra-builder-smoke-tests/builder-smoke` — want to use that, or give
> me a different path?

If the user supplied `--dir` on the command, skip the question. If they
already have `$BUILDER_SMOKE_TEST_DIR` exported, mention it and ask if
they want to use it or override. Don't ask if the choice was already made.

### 1. Preflight — scaffold + env vars + mode

Before starting the server, run preflight with the auth mode this prompt
expects (`off` for auth-off runs, `on` for the auth-on runs). Preflight
calls `scripts/scaffold.sh` first (creating or refreshing `$PROJECT_DIR`),
then validates the resulting `.env` against `--expect off|on`.

```bash
# Auth-off (the common case):
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off \
  --openai-key "$OPENAI_API_KEY"

# Auth-on (WorkOS):
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect on \
  --openai-key "$OPENAI_API_KEY" \
  --workos-api-key "$WORKOS_API_KEY" \
  --workos-client-id "$WORKOS_CLIENT_ID" \
  --workos-organization-id "$WORKOS_ORGANIZATION_ID"
```

The default `$PROJECT_DIR` is `~/mastra-builder-smoke-tests/builder-smoke`.
Pass `--dir <path>` to override. Pass `--reuse` to skip `pnpm install` when
`node_modules/@mastra/core` already exists.

Why `.env` matters more than your shell: `mastra dev` reads
`$PROJECT_DIR/.env` via dotenv and **overwrites `process.env`** with the
loaded values (see `packages/cli/src/commands/dev/dev.ts` around line 384).
That means:

- Inline overrides on the command line are silently clobbered.
- Shell-only vars survive only if `.env` has no entry for the same key.
- The auth mode the server actually runs in is determined by `.env` alone.

The scaffold owns `$PROJECT_DIR/.env`. To change anything in it, re-run
`scripts/scaffold.sh` (or `scripts/preflight.sh`, which wraps it) with the
flags you want.

### 2. Zombie port check

`mastra dev` auto-increments past `:4111` if it's busy (`:4112`, `:4113`…).
If you don't catch this, every subsequent `curl` hits the wrong server.

```bash
lsof -i :4111
# If a node/mastra process is listening from an earlier session, kill it:
kill $(lsof -ti :4111) 2>/dev/null || true
```

### 3. Start the dev server

```bash
cd ~/mastra-builder-smoke-tests/builder-smoke   # or whichever --dir you used
pnpm mastra:dev
```

The scaffolded `package.json` defines `mastra:dev` (server only) and
`dev:ui` (server + playground). For smoke tests, prefer `mastra:dev` and
use whichever browser tool the harness has wired up for the UI section.

### 4. Wait for readiness

The SPA shell at `/` can 200 before the API is mounted. Probe `/api/agents`
instead — `wait-for-server.sh` handles this and also detects the
port-bumped case.

```bash
bash .claude/skills/builder-smoke-test/scripts/wait-for-server.sh
```

If it reports the server is on `:4112`+ instead of `:4111`, stop, free the
port, and restart — running on a non-default port will silently break the
rest of the smoke (every curl in every reference assumes `:4111`).

### 5. Builder settings

```bash
curl -s $BASE/editor/builder/settings | jq .
```

**Verify:**

- [ ] Response contains `configuration.agent.workspace` with `type: "id"` and a `workspaceId`
- [ ] Response contains `features.agent.skills: true` (the `features` block is namespaced under `agent` — there is no top-level `features.skills`)
- [ ] Response contains **both** `configuration.agent.models.{allowed,default}` and a top-level `modelPolicy.{active, pickerVisible, allowed, default}`. They mirror each other; Model Policy assertions later in the suite key off `modelPolicy` specifically.

Record the `workspaceId` — this is the **builder workspace ID** used in all subsequent tests.

### 6. Baseline state

Record what already exists:

List endpoints return a paginated envelope: `{ hasMore, page, perPage, total, workspaces|agents|skills }`. The arrays live under the named key; use `.<key> | length` for the page count and `.total` for the full count.

> The page array is filtered for caller visibility (private records the caller can't see are excluded), but `total` reflects the underlying DB count for the query. Expect `(.<key> | length) <= .total` even on the first page when private records exist that the caller can't see.

```bash
# Workspaces
curl -s $BASE/stored/workspaces | jq '{ page: (.workspaces | length), total: .total }'

# Agents
curl -s $BASE/stored/agents | jq '{ page: (.agents | length), total: .total }'

# Skills
curl -s $BASE/stored/skills | jq '{ page: (.skills | length), total: .total }'
```

Note these counts — they help distinguish pre-existing entities from test-created ones.

### 7. Builder workspace exists

Resolve the builder workspace ID first (it's whatever is registered via the editor builder config — typically the only workspace with `metadata.source = "builder"`):

```bash
WORKSPACE_ID=$(curl -s $BASE/stored/workspaces | jq -r '.workspaces[] | select(.metadata.source == "builder") | .id' | head -1)
echo "WORKSPACE_ID=$WORKSPACE_ID"
curl -s $BASE/stored/workspaces/$WORKSPACE_ID | jq .
```

**Verify:**

- [ ] Workspace exists in DB (not 404)
- [ ] `metadata.source` is `"builder"`
- [ ] `filesystem.provider` and `filesystem.config.basePath` are present
- [ ] `runtimeRegistered: true` — only on the list response, **not** the detail GET above:
  ```bash
  curl -s $BASE/stored/workspaces | jq '.workspaces[] | select(.id == "'"$WORKSPACE_ID"'") | .runtimeRegistered'
  # → true
  ```

If the workspace doesn't exist yet, it means `ensureBuilderWorkspaces()` hasn't run — check that the `Workspace` instance is registered in the Mastra constructor in `$PROJECT_DIR/src/mastra/index.ts`.

## Cookie extraction (auth on only)

Under `--auth on`, before any other section runs `curl` against an authenticated endpoint, follow `references/auth.md` step 0 to extract the session cookie via `GET /smoke-test/cookie` (gated by `SMOKE_TEST_COOKIE_LEAK=1` in `$PROJECT_DIR/.env`). Export it as `$COOKIE` and use `-H "Cookie: $COOKIE"` for the rest of the run. The cookie is `httpOnly` and cannot be obtained any other way — do not skip auth-on `curl` checks because you "can't get the cookie."

## Checklist

- [ ] Preflight passes for the expected mode (`--expect off` or `--expect on`)
- [ ] Port `:4111` is free, or the zombie has been killed
- [ ] Server started with `pnpm mastra:dev` from `$PROJECT_DIR` after the most recent scaffold
- [ ] `wait-for-server.sh` reports ready on `:4111` (not `:4112`+)
- [ ] Builder settings endpoint returns valid config (`features.agent.skills: true`, both `configuration.agent.models` and `modelPolicy` present)
- [ ] Builder workspace exists in DB with correct metadata (and `runtimeRegistered: true` on the list response)
- [ ] Baseline entity counts recorded from `{ page, total }` shape
- [ ] Under `--auth on`: `$COOKIE` exported via `/smoke-test/cookie` recipe (see `references/auth.md` step 0)
