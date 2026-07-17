---
name: builder-smoke-test
description: Smoke test the Agent Builder feature branch end-to-end against a hermetic project scaffolded by the skill (linked to the current worktree). Covers workspace reconciliation, stored agents/skills CRUD, ownership, visibility, stars, registry/library Copy flow, picker allowlists, model policy, RBAC role gating, role impersonation UI, builder defaults, infrastructure diagnostics, channels, and Studio + Agent Builder UI. Trigger when validating the agent-builder feature branch, PRs that touch packages/server, packages/playground, packages/playground-ui agent-builder routes, or builder EE code paths.
---

# Builder Smoke Test

End-to-end smoke testing of the Agent Builder feature set against a hermetic project the skill scaffolds at `~/mastra-builder-smoke-tests/builder-smoke` (configurable). The project links to the current worktree via `pnpm` `link:` overrides, so changes to packages under `packages/`, `stores/`, `auth/`, `channels/`, `observability/`, `browser/`, and `client-sdks/` take effect on the next `mastra dev` restart.

This skill is for **branch QA** — it complements the release-time `mastra-smoke-test`. It exercises the Builder EE surface (stored entities, RBAC, registry, infra, channels) using a minimal, predictable project rather than the kitchen-sink `examples/agent`.

## ⚠️ Mandatory Test Checklist

**Use `task_write` to track progress.** Run ALL sections unless `--test` or `--scope` narrows the run.

**Do not skip sections unless you hit an actual blocker.** "Seemed complex" or "I'll come back to it" are not valid reasons. Attempt every step — only stop when you literally cannot proceed. Report what you tried and what blocked you.

| #   | Section                | Reference                        | When required                                                           |
| --- | ---------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| 1   | **Setup**              | `references/setup.md`            | Always                                                                  |
| 2   | **Workspace**          | `references/workspace.md`        | `--test workspace` or full                                              |
| 3   | **Reconciliation**     | `references/reconciliation.md`   | Steps 1 + 5 only; steps 2/3/4/6 are out of smoke-test scope (see below) |
| 4   | **Defaults**           | `references/defaults.md`         | `--test defaults` or full                                               |
| 5   | **Model Policy**       | `references/model-policy.md`     | `--test model-policy` or full                                           |
| 6   | **Skills**             | `references/skills.md`           | `--test skills` or full                                                 |
| 7   | **Registry**           | `references/registry.md`         | `--test registry` or full                                               |
| 8   | **Agents**             | `references/agents.md`           | `--test agents` or full                                                 |
| 9   | **Picker Allowlists**  | `references/picker-allowlist.md` | `--test pickers` or full                                                |
| 10  | **Favorites**          | `references/favorites.md`        | `--test favorites` or full (formerly `stars`)                           |
| 11  | **Permissions / RBAC** | `references/permissions.md`      | `--test permissions` or full                                            |
| 12  | **Infrastructure**     | `references/infrastructure.md`   | `--test infrastructure` or full                                         |
| 13  | **Channels**           | `references/channels.md`         | `--test channels` or full                                               |
| 14  | **UI**                 | `references/ui.md`               | `--test ui` or full                                                     |
| 15  | **Auth**               | `references/auth.md`             | `--test auth` or `--auth on`                                            |

### Execution flow

1. **Confirm the project directory.** Before scaffolding, ask the user where they want `$PROJECT_DIR` to live. Offer the default (`~/mastra-builder-smoke-tests/builder-smoke`) as a suggestion. Skip the question if they already passed `--dir` or have `$BUILDER_SMOKE_TEST_DIR` exported. See `references/setup.md` step 0.
2. **Read the reference file** for each section you're about to run.
3. **Under `--auth on`, extract the session cookie before running any other section.** The WorkOS cookie is `httpOnly`, so `curl` cannot mint it and `document.cookie` cannot read it. The scaffold ships a debug route at `GET /smoke-test/cookie` gated by `SMOKE_TEST_COOKIE_LEAK=1`. Follow the **"Extracting the session cookie for curl (auth on)"** section below before touching any auth-on endpoint. **Do not pivot to UI-only testing because curl is "blocked" — the cookie route is the unblock path.**
4. **Seed non-owner data after the server has booted at least once.** A fresh scaffold has no skills authored by anyone other than the test user, which makes non-owner / Library Copy / non-owner visibility / non-admin stars flows untestable. Run `bash .claude/skills/builder-smoke-test/scripts/seed-multi-user.sh` (or with `--dir $PROJECT_DIR`) before sections 6 (Skills), 7 (Registry), and 10 (Stars). The script is idempotent and bypasses RBAC by writing directly to libsql, so it works regardless of `--auth` mode or current role. **Do not mark non-owner steps as "blocked" without running this first.**
5. **Execute the steps** — use `curl` for API checks (with `-H "Cookie: $COOKIE"` under `--auth on`), whichever browser tool the harness has wired up (Stagehand, Chrome MCP, etc.) for UI checks.
6. **Record results** in the summary table.
7. **Mark the section complete** with `task_write` before moving to the next.

### Partial testing (`--test`)

If `--test` is provided:

1. Always run **Setup**.
2. Run only the specified section(s).
3. Skip everything else.

Example: `--test skills,registry,agents` → Setup + Skills + Registry + Agents.

### Scope shortcuts (`--scope`)

`--scope` runs a curated group of related sections. Setup is always implied.

| Scope    | Includes                                                      |
| -------- | ------------------------------------------------------------- |
| `rbac`   | permissions, auth                                             |
| `skills` | skills, registry, defaults                                    |
| `agents` | agents, pickers, defaults, model-policy                       |
| `infra`  | infrastructure, channels, reconciliation                      |
| `ui`     | ui                                                            |
| `quick`  | workspace, skills, agents, favorites, ui (skips long-running) |

`--scope` and `--test` can be combined; the union is run.

## Usage

```bash
# Full smoke (interactive)
/builder-smoke-test

# Specific sections
/builder-smoke-test --test workspace,skills
/builder-smoke-test --test agents,favorites
/builder-smoke-test --test reconciliation
/builder-smoke-test --test ui

# Scope shortcuts
/builder-smoke-test --scope rbac
/builder-smoke-test --scope skills
/builder-smoke-test --scope quick

# Force auth on / off (otherwise auto-detected from WORKOS_* env vars)
/builder-smoke-test --auth on
/builder-smoke-test --auth off

# Run auth-on as a non-admin role (must match the logged-in user's actual role)
/builder-smoke-test --auth on --role viewer
/builder-smoke-test --auth on --role member

# Skip the browser pass (API-only run)
/builder-smoke-test --skip-browser
```

## Parameters

| Parameter                                                                | Description                                                                                                                                                                                                                                                                                           | Default                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `--test`                                                                 | Comma-separated section names (see table above).                                                                                                                                                                                                                                                      | (all sections)                               |
| `--scope`                                                                | Named group of sections (`rbac`, `skills`, `agents`, `infra`, `ui`, `quick`). Combinable with `--test`.                                                                                                                                                                                               | (none)                                       |
| `--auth`                                                                 | `on`, `off`, or `auto`. `auto` enables the Auth section iff `WORKOS_CLIENT_ID` + `WORKOS_API_KEY` are set.                                                                                                                                                                                            | `auto`                                       |
| `--role`                                                                 | Expected role of the logged-in user under `--auth on`: `owner`, `admin`, `member`, or `viewer`. Setup asserts the live `/api/auth/me` roles match; on mismatch the run stops and the user is told to either change their WorkOS role or re-run with the correct `--role`. Ignored under `--auth off`. | `admin`                                      |
| `--clean`                                                                | Delete test entities (smoke-test workspaces / agents / skills) at the end of each section.                                                                                                                                                                                                            | `false`                                      |
| `--skip-browser`                                                         | Run only API/`curl` checks. UI section is skipped.                                                                                                                                                                                                                                                    | `false`                                      |
| `--dir`                                                                  | Project directory the skill scaffolds into. Forwarded to `scripts/scaffold.sh`. Also reads `$BUILDER_SMOKE_TEST_DIR` from the environment when the flag is omitted.                                                                                                                                   | `~/mastra-builder-smoke-tests/builder-smoke` |
| `--reuse`                                                                | If the project already exists at `$PROJECT_DIR` and has `node_modules/@mastra/core`, skip `pnpm install`. Forwarded to `scripts/scaffold.sh`.                                                                                                                                                         | `false`                                      |
| `--openai-key`                                                           | OPENAI_API_KEY value to write into the scaffolded `.env`. If omitted, the scaffold script falls back to `$OPENAI_API_KEY` in the shell, then to an interactive prompt.                                                                                                                                | (shell or prompt)                            |
| `--workos-api-key`<br>`--workos-client-id`<br>`--workos-organization-id` | All three are required together to scaffold an auth-on project. Writes `AUTH_PROVIDER=workos` plus the three keys plus `WORKOS_REDIRECT_URI=http://localhost:4111/api/auth/callback` into `.env`.                                                                                                     | (auth off)                                   |

If `--auth auto` and no WorkOS env vars are present, the Auth section is auto-skipped and reported as `⏭️ Skipped (no WORKOS_* env vars)`.

### Canonical order

When running multiple sections, execute them in the order shown in the
section table (1 → 15). The order is intentional:

- **Setup** must run first — preflight + readiness probe gate every later
  section.
- **Workspace / Reconciliation / Defaults / Model Policy** establish that
  the server's view of the project matches what the rest of the run
  assumes. Run them before any CRUD pass.
- **Skills → Registry → Agents → Pickers → Stars** is a build-up: agents
  reference skills, pickers depend on the entities created above.
- **Permissions / Infrastructure / Channels / UI** are read-mostly
  inspections that benefit from existing entities.
- **Auth** runs last because it requires restarting `mastra dev` with a
  different `.env`.

If `--test` or `--scope` narrows the run, keep the relative order — just
skip the sections that fall outside the selection.

### Required vs optional reference tiers

References fall into three tiers; an agent should treat them
accordingly:

- **Required (every run):** `setup.md`. Any failure here blocks the rest
  of the run.
- **Standard (default tiers for `full`, `quick`, scope shortcuts):**
  `workspace.md`, `skills.md`, `agents.md`, `favorites.md`, `ui.md` (core),
  `auth.md` when `--auth on`.
- **Extended (only when explicitly selected via `--test`/`--scope` or
  the matching code surface changed):** `reconciliation.md`,
  `defaults.md`, `model-policy.md`, `registry.md`, `picker-allowlist.md`,
  `permissions.md`, `infrastructure.md`, `channels.md`, `ui.md` extended
  tier.

When skipping an extended section, mark it `⏭️ Skipped (not in scope)`
in the result table — don't silently omit it.

### Cleanup

The scaffold is a self-contained throwaway directory at `$PROJECT_DIR`. All
fixture state (workspaces, agents, skills, libsql DB, `.mastra/workspace`
files) lives inside it. The smoke test never writes to anything outside
`$PROJECT_DIR` (other than the dev server it runs).

At the end of every run:

1. Stop the dev server (`kill $(lsof -i :4111 -sTCP:LISTEN -t)` or
   foreground `Ctrl-C`).
2. Choose how to dispose of fixture state:
   - **Reuse:** leave `$PROJECT_DIR` in place. The next run can pass
     `--reuse` (or `--skip-scaffold` to preflight) and pick up where this
     one left off. Fastest for iterating.
   - **Reset:** `rm -rf "$PROJECT_DIR"` (or re-run `scripts/scaffold.sh`
     without `--reuse`). Cheapest way to get back to a known-clean state.
     Don't bother per-entity DELETE — the directory IS the state.
3. If a section bailed mid-flight (assertion failure, network error),
   record the partial state in the report's **Issues** section so the
   next run knows what to expect.

Per-entity DELETE calls are only needed when a specific section
explicitly tests DELETE behavior (those sections include the DELETE step
inline). Otherwise the throwaway-directory model handles cleanup.

Never leave the dev server running on `:4111` after the report is filed —
it blocks future runs.

## Prerequisites

- Working tree on the agent-builder feature branch (or any branch you want to QA).
- `pnpm` (10.x) and `node` on `$PATH`. The scaffold uses `pnpm install --ignore-workspace` inside the project dir so the repo-level workspace doesn't interfere.
- An `OPENAI_API_KEY`. Supply via `--openai-key`, export `OPENAI_API_KEY` in the shell, or let the scaffold prompt for it.
- (Optional) WorkOS credentials for `--auth on` runs: `--workos-api-key`, `--workos-client-id`, `--workos-organization-id`.
- Whichever browser MCP/tool the harness has access to. If none is available, run with `--skip-browser` and report UI as `⏭️ Skipped (no browser tool)`.

### Project layout (scaffolded for you)

```text
$PROJECT_DIR/                                    ← see "Project dir resolution" below
├── package.json                                 ← pnpm overrides → link:<worktree>/packages/*
├── tsconfig.json
├── .env                                         ← OPENAI_API_KEY (+ AUTH_PROVIDER + WORKOS_* on auth-on)
└── src/mastra/
    ├── index.ts                                 ← single Mastra instance, reads exported bindings from auth.ts
    ├── auth.ts                                  ← top-level switch(process.env.AUTH_PROVIDER); no-op when unset
    ├── agents/index.ts                          ← weather-agent (gpt-4o-mini)
    ├── tools/index.ts                           ← weather-info tool
    └── workflows/index.ts                       ← greet-workflow
```

The `.env` is the **only** thing that flips auth on/off — the same `src/mastra/index.ts` runs in both modes. Re-run `scripts/scaffold.sh` with or without `--workos-*` to switch.

### Project dir resolution

`$PROJECT_DIR` is determined by every script (scaffold, preflight, wait-for-server) using this order:

1. `--dir <path>` flag
2. `BUILDER_SMOKE_TEST_DIR` env var (e.g. `export BUILDER_SMOKE_TEST_DIR=~/code/builder-smoke`)
3. `~/mastra-builder-smoke-tests/builder-smoke` (default)

For a long-lived setup, exporting `BUILDER_SMOKE_TEST_DIR` once in your shell rc is the lowest-friction option — every script picks it up automatically.

### Running scripts (cwd matters)

All scripts under `.claude/skills/builder-smoke-test/scripts/` resolve the worktree root from their own location. They can be invoked from anywhere, but conventionally the repo root.

| Script               | Run from | Notes                                                                                                                                                                                                                                        |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scaffold.sh`        | anywhere | Creates / refreshes `$PROJECT_DIR`. Forwards `--openai-key`, `--workos-*`, `--reuse`, `--dir`.                                                                                                                                               |
| `preflight.sh`       | anywhere | Calls `scaffold.sh` then asserts the resulting `.env` matches `--expect off\|on`.                                                                                                                                                            |
| `wait-for-server.sh` | anywhere | Hits `http://localhost:4111/api/agents`. cwd doesn't matter.                                                                                                                                                                                 |
| `seed-multi-user.sh` | anywhere | Inserts two skills owned by `user_seed_other` (1 public + 1 private) into the scaffold's libsql DB so non-owner / Library Copy flows can be tested without a second WorkOS account. Server must have booted at least once first. Idempotent. |

Invoke them as `bash .claude/skills/builder-smoke-test/scripts/<name>.sh`. Don't `cd` into `scripts/` first — relative path resolution will break.

`pnpm mastra:dev` must be run from `$PROJECT_DIR` (where the scaffolded `package.json` is).

### How `mastra dev` reads env (important)

`mastra dev` loads `$PROJECT_DIR/.env` via dotenv and **unconditionally overwrites `process.env`** with whatever's there (`packages/cli/src/commands/dev/dev.ts` ~line 384). Practical consequences:

- **`.env` is the source of truth for the running server.** Inline overrides like `AUTH_PROVIDER= pnpm mastra:dev` are silently clobbered.
- **Shell-only vars survive only if `.env` has no entry for the same key.** Re-running `scripts/scaffold.sh` always overwrites `.env`, so to toggle modes, re-scaffold.
- **The auth mode the server actually runs in is determined by `.env` alone.** A globally exported `AUTH_PROVIDER=workos` in your shell does NOT enable WorkOS auth in the server if `.env` doesn't have it — but it WILL leak into anything else this process runs, which is its own kind of confusing. Preflight flags this case.

### Auth modes

Two states matter:

- **auth off** — `AUTH_PROVIDER` is absent (or blank) in `$PROJECT_DIR/.env`. No WorkOS, no RBAC, no FGA. This is the state for the auth-off run.
- **auth on** — `AUTH_PROVIDER=workos` plus `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_ORGANIZATION_ID` all present in `$PROJECT_DIR/.env`. WorkOS authentication + role-based access + per-resource FGA all engage. This is the state for the auth-on runs. FGA is wired through the WorkOS auth provider — it can't be disabled independently.

To switch modes, re-run the scaffold with or without the `--workos-*` flags; that's faster and safer than hand-editing `.env`.

### Detection: run preflight before each section

```bash
# Scaffold (or refresh) the project and assert the auth-off baseline:
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off \
  --openai-key "$OPENAI_API_KEY"

# Scaffold an auth-on project (re-runs scaffold with WorkOS keys, asserts auth on):
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect on \
  --openai-key "$OPENAI_API_KEY" \
  --workos-api-key "$WORKOS_API_KEY" \
  --workos-client-id "$WORKOS_CLIENT_ID" \
  --workos-organization-id "$WORKOS_ORGANIZATION_ID"
```

Preflight chains `scaffold.sh` followed by validation checks (project exists with `node_modules/@mastra/core`, `$PROJECT_DIR/.env` has `OPENAI_API_KEY`, optional WorkOS keys present when `--expect on`, and auth mode matches `--expect`). Each failure prints a stable error code; this table tells the agent what to do.

### Resolving missing env vars

If `scaffold.sh` or `preflight.sh` reports a missing `OPENAI_API_KEY` or `WORKOS_*` var, the agent must **not** silently source any rc file. Instead, work down this list and stop at the first one that resolves:

1. Check whether the var is already in the process env you can see (`echo "${OPENAI_API_KEY:-<unset>}"`). If yes, re-run scaffold with `--openai-key "$OPENAI_API_KEY"` (and equivalent for WorkOS).
2. Check whether the var is in `$PROJECT_DIR/.env` from a prior run (`grep -E "^(OPENAI_API_KEY|WORKOS_)" "$PROJECT_DIR/.env" 2>/dev/null`). If yes, you can pass `--reuse` to the next scaffold call.
3. If neither, look for rc files that exist on disk. Common candidates: `~/.zshrc`, `~/.bashrc`, `~/.zshenv`, `~/.profile`, `~/.env.global`, and any project-local `.env` you find. Use `ls -1` (or `test -f`) to confirm before listing — don't fabricate paths.
4. Ask the user in one message: "Can you paste the value(s), or give me permission to source one of these files?" Include the list of files that actually exist.
5. Only after the user explicitly approves a specific file, source it in a subshell and rerun preflight with the inherited env. Pattern:

   ```bash
   # auth off
   zsh -c 'source <approved-file> && bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off --reuse'

   # auth on (preflight auto-picks WORKOS_API_KEY / WORKOS_CLIENT_ID / WORKOS_ORGANIZATION_ID from the sourced env)
   zsh -c 'source <approved-file> && bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect on --reuse'
   ```

   Use `bash -c` instead of `zsh -c` if the approved file is a bashrc.

6. Never write the secret value back into any rc file, never `export` it into the user's interactive shell, and never echo it back in chat in full. Refer to it as `<your-openai-key>` once you've used it.

| Error code                           | What it means                                                                                                                   | What the agent should do                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `project-dir-missing`                | `$PROJECT_DIR` is unset or the directory does not exist (scaffold did not run, or was given a bad `--dir`).                     | Re-run preflight without `--skip-scaffold`, or pass an existing `--dir <path>` that scaffold has already populated.                      |
| `scaffold-failed`                    | `scripts/scaffold.sh` returned non-zero.                                                                                        | Re-run scaffold with `--no-reuse` to force a fresh install. Inspect the printed `pnpm install` output for the real error.                |
| `project-deps-missing`               | `$PROJECT_DIR/node_modules/@mastra/core` missing after scaffold.                                                                | Re-run scaffold without `--reuse` to force a fresh install. If that still fails, delete `$PROJECT_DIR` and re-run.                       |
| `openai-key-missing-in-project-env`  | `$PROJECT_DIR/.env` has no usable `OPENAI_API_KEY`.                                                                             | Follow the "Resolving missing env vars" section above. Re-run preflight with `--openai-key <value>` once you have it.                    |
| `workos-keys-missing-in-project-env` | `--expect on` but one or more of `WORKOS_API_KEY` / `WORKOS_CLIENT_ID` / `WORKOS_ORGANIZATION_ID` is absent or blank in `.env`. | Follow the "Resolving missing env vars" section above. Re-run preflight with all three `--workos-*` flags.                               |
| `mode-mismatch`                      | `--expect` disagrees with the auth mode detected from `$PROJECT_DIR/.env`.                                                      | Re-run the scaffold with (auth on) or without (auth off) `--workos-*` flags. The scaffold is idempotent for the parts that don't change. |
| `bad-expect-value`                   | `--expect` got something other than `off` or `on`.                                                                              | Fix the invocation. (Parser also rejects flag-like values at parse time with exit 2.)                                                    |

**`.env` policy:** the scaffold **owns** `$PROJECT_DIR/.env`. Re-running scaffold overwrites it. Do not hand-edit the scaffolded `.env`; instead, re-run scaffold with different flags. (The skill never edits `.env` files outside `$PROJECT_DIR`.)

### Extracting the session cookie for curl (auth on)

The WorkOS session cookie is `httpOnly`, so `document.cookie` and Stagehand's
`extract` cannot read it from a normal page. To hit authenticated endpoints
from `curl` after a browser SSO login, the scaffold exposes a tiny debug
route gated by an env var:

1. Add `SMOKE_TEST_COOKIE_LEAK=1` to `$PROJECT_DIR/.env` (single line append; the scaffold leaves this var alone on re-run as long as the file already exists).
2. Restart `mastra dev` so the new env is picked up.
3. Sign in once in the Stagehand browser (`stagehand_navigate` to `http://localhost:4111`, complete WorkOS SSO).
4. From the same browser tab, navigate to `http://localhost:4111/smoke-test/cookie` and use `stagehand_extract` to read the page body. The page is a single `text/plain` line containing the request's `Cookie` header verbatim (e.g. `wos_session=…`).
5. Export it once: `export COOKIE='<the-string-from-step-4>'`. From here on, every authenticated curl is `curl -H "Cookie: $COOKIE" "$BASE/…"`.

The route is **only registered when `SMOKE_TEST_COOKIE_LEAK=1`** and is intentionally insecure — never enable it in a real project. The `WORKOS_COOKIE_PASSWORD` written by the scaffold is derived from `$PROJECT_DIR`, so the cookie value stays valid across `mastra dev` restarts within the same scaffold; you only need to repeat step 4 if you re-scaffold to a new directory.

> **`/smoke-test/cookie` returns 404? Always an env-ordering issue.** The `apiRoutes` list is built once when `mastra dev` boots from `process.env.SMOKE_TEST_COOKIE_LEAK`. The flag has to be in `.env` **before** the boot — adding it after start has no effect until you restart. If you see a 404, run `grep SMOKE_TEST_COOKIE_LEAK "$PROJECT_DIR/.env"`, then stop and restart `mastra dev`. Don't pivot to "UI only" because of this.

### Seeding non-owner skills (Library Copy / non-owner flows)

A fresh scaffold has zero skills, and everything created through the API
is owned by either the auth-off "no caller" (no `authorId`) or the
currently signed-in user under auth-on. To exercise flows that require a
skill **owned by someone else** (Library Copy, non-owner read-only view,
private-skill visibility from a non-owner) without provisioning a second
WorkOS account, run the seed script after the server has booted at least
once:

```bash
# Start the server once so libsql initializes the skills tables.
cd $PROJECT_DIR
pnpm mastra:dev                # leave running, then in another shell:

bash .claude/skills/builder-smoke-test/scripts/seed-multi-user.sh
# → seeds smoke-seed-public-skill  (visibility=public,  status=published)
#         smoke-seed-private-skill (visibility=private, status=published)
#   both owned by authorId='user_seed_other'
```

The script writes directly to `$PROJECT_DIR/src/mastra/public/mastra.db`
via the `sqlite3` CLI (no Node deps). It's idempotent — re-running
replaces the seeded rows. Use the seeded skills wherever a reference
file asks for "a skill owned by another user"; clean them up with
`DELETE` curls against `/api/stored/skills/:id` or by re-scaffolding.

## Starting the dev server

If the server is not running on `:4111`, the Setup section starts it. The convenience helpers live under `scripts/`:

```bash
# Scaffold + preflight (writes .env, installs deps, detects auth mode)
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off

# Start the server from the scaffolded project
cd ~/mastra-builder-smoke-tests/builder-smoke
pnpm mastra:dev

# Poll /api/agents until 200 (60s budget). Detects mastra dev's port-bump.
bash .claude/skills/builder-smoke-test/scripts/wait-for-server.sh
```

`wait-for-server.sh` probes `/api/agents` — not `/` — because the SPA shell can return 200 before the API mounts. If it reports the server is up on `:4112`+ instead of `:4111`, `mastra dev` fell through to the next port; stop, free `:4111`, and restart. Continuing on a non-default port silently breaks every curl in every reference.

## API base URL

Every reference assumes `$BASE` is exported. Set it once at the start of the run:

```bash
export BASE=http://localhost:4111/api
```

All curl examples in the references use `$BASE` and won't work in a shell that hasn't exported it.

## Quick reference: key endpoints

This table lists the surfaces an agent will hit and where to look for the
authoritative request/response shape. Don't copy curl blocks from here —
run the per-section commands in `references/<section>.md`.

| Surface           | Endpoint                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| Builder settings  | `GET /editor/builder/settings`                                             |
| Builder infra     | `GET /editor/builder/infrastructure`                                       |
| Registries (list) | `GET /editor/builder/registries`                                           |
| Registry search   | `GET /editor/builder/registries/:registryId/search?q=…`                    |
| Registry popular  | `GET /editor/builder/registries/:registryId/popular`                       |
| Registry preview  | `GET /editor/builder/registries/:registryId/preview?owner=…&repo=…&path=…` |
| Registry install  | `POST /editor/builder/registries/:registryId/install`                      |
| Workspace CRUD    | `GET/POST/PATCH/DELETE /stored/workspaces[/:id]`                           |
| Agent CRUD        | `GET/POST/PATCH/DELETE /stored/agents[/:id]`                               |
| Agent favorite    | `PUT / DELETE /stored/agents/:id/favorite`                                 |
| Agent avatar      | `PATCH /stored/agents/:id` with `metadata.avatarUrl` (owner-only)          |
| Skill CRUD        | `GET/POST/PATCH/DELETE /stored/skills[/:id]`                               |
| Skill publish     | `POST /stored/skills/:id/publish`                                          |
| Skill favorite    | `PUT / DELETE /stored/skills/:id/favorite`                                 |
| Auth me           | `GET /api/auth/me` (returns logged-in user + roles + permissions)          |
| Auth refresh      | `POST /auth/refresh`                                                       |

## Builder Studio routes

| Feature                 | Route                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Agent Builder shell     | `/agent-builder`                                                                           |
| Agents (default view)   | `/agent-builder`                                                                           |
| Agent detail (view)     | `/agent-builder/agents/:id/view` (bare `:id` redirects to `/view`)                         |
| Agent detail (edit)     | `/agent-builder/agents/:id/edit`                                                           |
| Skills                  | `/agent-builder/skills`                                                                    |
| Library (public skills) | `/agent-builder/library`                                                                   |
| Skill detail            | `/agent-builder/skills/:id/edit` (owner) or `/agent-builder/skills/:id/view` (non-owner)   |
| Workspaces              | `/agent-builder/workspaces`                                                                |
| Infrastructure          | `/agent-builder/infrastructure` (readable by every default role — see `infrastructure.md`) |

Mobile renders a bottom-bar with the same primary entries.

## Browser smoke

Use whichever browser tool the harness has wired up (Stagehand, Chrome MCP, etc.). Don't assume a specific provider — discover what's available, then drive the same checklist in `references/ui.md`.

The scaffolded project registers `StagehandBrowser` (matching `examples/agent-builder`). If `BROWSERBASE_*` keys aren't set in the shell, Stagehand falls back to local Playwright; that's fine for smoke. If neither Stagehand nor a local browser is reachable, mark UI as `⏭️ Skipped (no browser provider)`.

## Result reporting

After testing, provide:

```md
## Builder Smoke Test Results

**Date**: <date>
**Branch**: <branch>
**Commit**: <short sha>
**Server**: scaffolded project @ localhost:4111 (`$PROJECT_DIR`)
**Auth**: on / off / auto-skipped

| #   | Section            | Status   | Notes                           |
| --- | ------------------ | -------- | ------------------------------- |
| 1   | Setup              | ✅/❌    |                                 |
| 2   | Workspace          | ✅/❌    |                                 |
| 3   | Reconciliation     | ✅/❌/⏭️ |                                 |
| 4   | Defaults           | ✅/❌    |                                 |
| 5   | Model Policy       | ✅/❌    |                                 |
| 6   | Skills             | ✅/❌    |                                 |
| 7   | Registry           | ✅/❌    |                                 |
| 8   | Agents             | ✅/❌    |                                 |
| 9   | Pickers            | ✅/❌    |                                 |
| 10  | Stars              | ✅/❌    |                                 |
| 11  | Permissions / RBAC | ✅/❌    |                                 |
| 12  | Infrastructure     | ✅/❌    |                                 |
| 13  | Channels           | ✅/❌    |                                 |
| 14  | UI                 | ✅/❌/⏭️ |                                 |
| 15  | Auth               | ✅/❌/⏭️ | (skipped if no WORKOS\_\* vars) |

**Product issues**: (list any — server/UI behaved unexpectedly. For each: HTTP method + path or UI route, expected vs actual, one-sentence guess at the cause. Do not pre-decide "known bug" — log what the server actually did. Say "none" if empty.)
**Skill issues**: (list any — the skill itself was wrong, unclear, stale, or unreachable. For each: which file + step (e.g. `references/skills.md` step F2), and what was wrong. Doc drift, not product bugs. Say "none" if empty.)

**Verify before filing.** Before adding anything to either list, re-confirm against the live response in this run, not memory of an earlier call:

- For any **shape mismatch / missing field / wrong key name** claim, paste the actual JSON fragment (or the relevant keys) directly under the bullet so the claim is reproducible. If the skill says `features.agent.skills` and the response has `features.agent.skills`, that is not a skill issue — names that look similar in passing (`featSkills`, `agent.features.skill`, etc.) are easy to misread.
- For any **endpoint inconsistency** claim (e.g. "endpoint A returns X but B returns Y"), re-curl both endpoints fresh in the same run rather than reusing a stale response from earlier in the section.
- For any **RBAC / authz** claim (403 where you expected 200, or vice versa), check `references/permissions.md` for the matrix _and_ check the "Design decisions" list in this file. Several roles intentionally share `*:read`, which means infra/list/get endpoints look "ungated" but are working as intended. Also confirm the cookie you sent belongs to the role you think it does (`curl -H "Cookie: $(cat /tmp/cookie.txt)" $BASE/auth/me | jq '.role // .roles'`).
- For any **missing endpoint** claim (e.g. "agent avatar 404"), confirm the contract first — several flows are client-composed on top of generic CRUD (avatar = `PATCH metadata.avatarUrl`; Library Copy = `POST /stored/skills` with `metadata.origin`). The "Design decisions (don't file as bugs)" section enumerates the common ones.
- If a claim can't be reproduced on a fresh request, drop it.
  **Regressions**: (list any behavioral changes from a previous run)
  **Warnings**: (e.g., dev-server crash on `/auth/refresh` polling, OPENAI_API_KEY required at startup)
  **Skipped sections**: (list with reason)
```

## Known rough edges

The branch has accumulated minor papercuts. Note these in your report only if you hit them; don't fail the run on them:

- Don't `rm` `$PROJECT_DIR/mastra.db` by hand while the server is up — stop the server first, then delete.
- Dev server can crash on hot-reload from `/auth/refresh` polling. Restart and continue.
- `OPENAI_API_KEY` is required at startup — server won't boot without it, even if you only test non-LLM surfaces.
- `mastra dev` overwrites `process.env` from `.env` at boot, so inline env overrides on the command line don't reach the server. Re-run scaffold to change `.env`.
- The scaffold links against the **current worktree's** packages via `link:` overrides. If you switch worktrees, re-run scaffold so the symlinks point at the right tree.

## Design decisions (don't file as bugs)

These have come up across multiple runs and are intentional. If you observe one, note it in your report as "expected behavior" — do **not** open a product issue.

- **`GET /auth/me` without a cookie returns `200` with a `null`-ish body.** The route is mounted as a public route (`createPublicRoute`); the contract is "return the current user or `null`", not "401 if missing". A `401` here would break the public app shell.
- **`/editor/builder/infrastructure` is readable by every default role (admin / member / viewer).** The handler gates on `infrastructure:read` and every default role has `*:read`, which matches by resource-wildcard. The page only exposes deployment-shape data (provider names, registered flags, configured/unconfigured booleans) — no secrets.
- **Flipping a skill's `visibility` from `private` to `public` does not auto-publish unless the skill has a registered `skillPath`.** Visibility and publication are independent fields by design. A plain-create skill flipped public stays at `activeVersionId: null` until a real `POST /publish` runs against a source path.
- **Zod schema validation runs before the permission middleware on `/stored/*` writes.** A malformed body from a viewer returns a 400, not a 403. This is standard request lifecycle; the response surface doesn't leak resource state.
- **The role-impersonation picker only lists roles _different from the current one_.** Logged in as `admin`, you'll see `Member` and `Viewer` and nothing else — there is no `Admin` self-item. This is intentional (admin is the baseline; you're already there).
- **Impersonation is UI-only.** The API still answers per the real logged-in role. A `curl` while impersonating `viewer` will still return the admin's response.
- **`Favorites` sidebar entry links to `/agent-builder/favorite` (singular).** The plural `/favorites` is not a registered route and renders the React Router 404. Use the sidebar link or the singular URL when scripting.
- **Avatar upload uses agent `PATCH` with `metadata.avatarUrl`, not a dedicated `/avatar` endpoint.** See `references/agents.md`.
- **Copy is client-side.** There is no `POST /stored/skills/:id/copy`. The UI fetches the source skill and POSTs a new row to `/stored/skills` with `metadata.origin = "library-copy"`. See `references/registry.md`.

## Out of smoke-test scope

Some flows are documented in `references/` but are not driven by the smoke-test agent because they require server-lifecycle gymnastics that don't fit a single run:

- **Reconciliation steps 2/3/4/6** (`references/reconciliation.md`) require editing `$PROJECT_DIR/src/mastra/index.ts` (changing `basePath` / `workspaceId` / config), restarting `mastra dev` multiple times, and observing drift detection or orphan archival across restarts. The smoke-test agent runs only **Step 1** (fresh-startup persistence) and **Step 5** (non-builder workspaces untouched). Run the rest by hand when changing reconciliation code.
- **Real role-swap testing** (logging in as multiple WorkOS users with different roles in the same run) is out of scope. The agent verifies whichever role the live `--role` user actually has, and additionally exercises the **UI-only role impersonation** flow under `--role admin` (see `references/ui.md`).

## References

- `references/setup.md` — server health, builder settings sanity, baseline counts, builder workspace existence
- `references/workspace.md` — workspace CRUD via API
- `references/reconciliation.md` — config-driven workspace lifecycle (fresh, idempotent, drift, archival, backfill)
- `references/defaults.md` — builder defaults applied at agent create (memory, workspace, browser, model)
- `references/model-policy.md` — allowed list, default model, dropdown filtering, rejection
- `references/skills.md` — skill CRUD, visibility, publish, filesystem writes, files array
- `references/registry.md` — skills.sh browse/install, library Copy flow, origin badges, gating
- `references/agents.md` — stored agent CRUD, skill attachment, model swap, delete-from-edit, avatar upload
- `references/picker-allowlist.md` — tools/agents/workflows pickers respect allowlists
- `references/favorites.md` — favorite/unfavorite agents and skills, idempotency (formerly `stars.md`)
- `references/permissions.md` — viewer/member/admin/owner gating, role expectation matrix, UI impersonation, auth-off bypass
- `references/infrastructure.md` — `/editor/builder/infrastructure` payload + UI
- `references/channels.md` — Slack provider visibility, connectChannel tool
- `references/ui.md` — browser checklist across Builder routes
- `references/auth.md` — WorkOS on/off, 401 behavior, authorId, mode-toggle via `.env`
- `scripts/scaffold.sh` — scaffold or refresh the hermetic project at `$PROJECT_DIR`
- `scripts/preflight.sh` — wraps `scaffold.sh` + mode expectation (`--expect off|on`)
- `scripts/wait-for-server.sh` — poll `:4111` until healthy
