---
name: builder-smoke-test
description: Smoke test the Agent Builder feature branch end-to-end against examples/agent on localhost:4111. Covers workspace reconciliation, stored agents/skills CRUD, ownership, visibility, stars, registry/library Copy flow, picker allowlists, model policy, RBAC role gating, role impersonation UI, builder defaults, infrastructure diagnostics, channels, and Studio + Agent Builder UI. Trigger when validating the agent-builder feature branch, PRs that touch packages/server, packages/playground, packages/playground-ui agent-builder routes, or builder EE code paths.
---

# Builder Smoke Test

End-to-end smoke testing of the Agent Builder feature set against `examples/agent` running on `localhost:4111`.

This skill is for **branch QA** — it complements the release-time `mastra-smoke-test`. It exercises the Builder EE surface (stored entities, RBAC, registry, infra, channels) rather than a freshly scaffolded project.

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
| 10  | **Stars**              | `references/stars.md`            | `--test stars` or full                                                  |
| 11  | **Permissions / RBAC** | `references/permissions.md`      | `--test permissions` or full                                            |
| 12  | **Infrastructure**     | `references/infrastructure.md`   | `--test infrastructure` or full                                         |
| 13  | **Channels**           | `references/channels.md`         | `--test channels` or full                                               |
| 14  | **UI**                 | `references/ui.md`               | `--test ui` or full                                                     |
| 15  | **Auth**               | `references/auth.md`             | `--test auth` or `--auth on`                                            |

### Execution flow

1. **Read the reference file** for each section you're about to run.
2. **Execute the steps** — use `curl` for API checks, whichever browser tool the harness has wired up (Stagehand, Chrome MCP, etc.) for UI checks.
3. **Record results** in the summary table.
4. **Mark the section complete** with `task_write` before moving to the next.

### Partial testing (`--test`)

If `--test` is provided:

1. Always run **Setup**.
2. Run only the specified section(s).
3. Skip everything else.

Example: `--test skills,registry,agents` → Setup + Skills + Registry + Agents.

### Scope shortcuts (`--scope`)

`--scope` runs a curated group of related sections. Setup is always implied.

| Scope    | Includes                                                  |
| -------- | --------------------------------------------------------- |
| `rbac`   | permissions, auth                                         |
| `skills` | skills, registry, defaults                                |
| `agents` | agents, pickers, defaults, model-policy                   |
| `infra`  | infrastructure, channels, reconciliation                  |
| `ui`     | ui                                                        |
| `quick`  | workspace, skills, agents, stars, ui (skips long-running) |

`--scope` and `--test` can be combined; the union is run.

## Usage

```bash
# Full smoke (interactive)
/builder-smoke-test

# Specific sections
/builder-smoke-test --test workspace,skills
/builder-smoke-test --test agents,stars
/builder-smoke-test --test reconciliation
/builder-smoke-test --test ui

# Scope shortcuts
/builder-smoke-test --scope rbac
/builder-smoke-test --scope skills
/builder-smoke-test --scope quick

# Reset fixtures and re-seed (deletes examples/agent/mastra.db)
/builder-smoke-test --fixtures-reset --scope quick

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

| Parameter          | Description                                                                                                                                                                                                                                                                                           | Default        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `--test`           | Comma-separated section names (see table above).                                                                                                                                                                                                                                                      | (all sections) |
| `--scope`          | Named group of sections (`rbac`, `skills`, `agents`, `infra`, `ui`, `quick`). Combinable with `--test`.                                                                                                                                                                                               | (none)         |
| `--auth`           | `on`, `off`, or `auto`. `auto` enables the Auth section iff `WORKOS_CLIENT_ID` + `WORKOS_API_KEY` are set.                                                                                                                                                                                            | `auto`         |
| `--role`           | Expected role of the logged-in user under `--auth on`: `owner`, `admin`, `member`, or `viewer`. Setup asserts the live `/api/auth/me` roles match; on mismatch the run stops and the user is told to either change their WorkOS role or re-run with the correct `--role`. Ignored under `--auth off`. | `admin`        |
| `--fixtures-reset` | Stop the dev server, wipe `examples/agent/mastra.db`, restart, restore the seeded public skills.                                                                                                                                                                                                      | `false`        |
| `--clean`          | Delete test entities (smoke-test workspaces / agents / skills) at the end of each section.                                                                                                                                                                                                            | `false`        |
| `--skip-browser`   | Run only API/`curl` checks. UI section is skipped.                                                                                                                                                                                                                                                    | `false`        |

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
  `workspace.md`, `skills.md`, `agents.md`, `stars.md`, `ui.md` (core),
  `auth.md` when `--auth on`.
- **Extended (only when explicitly selected via `--test`/`--scope` or
  the matching code surface changed):** `reconciliation.md`,
  `defaults.md`, `model-policy.md`, `registry.md`, `picker-allowlist.md`,
  `permissions.md`, `infrastructure.md`, `channels.md`, `ui.md` extended
  tier.

When skipping an extended section, mark it `⏭️ Skipped (not in scope)`
in the result table — don't silently omit it.

### Cleanup

Always leave the project in a runnable state. At the end of every run:

1. Delete every smoke-test entity you created (workspaces, agents,
   skills). Use the per-section cleanup snippet from the matching
   reference file or `--clean`.
2. If you ran `--fixtures-reset`, confirm the seeded public skills are
   back in place by listing `/stored/skills?visibility=public`.
3. If you toggled `.env` for Auth, restore it to the state you found it
   in and ask the user to confirm.
4. If a section bailed mid-flight (assertion failure, network error),
   record the partial state in the report's **Issues** section so the
   next run knows what to expect.

Never leave the dev server running with stale fixtures or with `.env`
in a state the user didn't ask for.

## Prerequisites

- Working tree on the agent-builder feature branch.
- `examples/agent` installed standalone: `cd examples/agent && pnpm i --ignore-workspace`.
- `OPENAI_API_KEY` set in `examples/agent/.env` (preferred) OR exported in the shell. `examples/agent` instantiates `OpenAIVoice` at module load — without a key the server crashes inside `OpenAIVoice` (`voice/openai/dist/index.js`: `Error: No API key provided for speech model`) before HTTP ever opens.
- Whichever browser MCP/tool the harness has access to. If neither is available, run with `--skip-browser` and report UI as `⏭️ Skipped (no browser tool)`.

### Running scripts (cwd matters)

All four scripts under `.claude/skills/builder-smoke-test/scripts/` are designed to be invoked **from the repo root** (the directory with `pnpm-workspace.yaml`). They resolve `examples/agent/` and `examples/agent/.env` relative to that root.

| Script               | Run from              | Notes                                                                             |
| -------------------- | --------------------- | --------------------------------------------------------------------------------- |
| `preflight.sh`       | repo root             | Will exit `not-in-mastra-repo` if `pnpm-workspace.yaml` isn't in the current cwd. |
| `auth-detect.sh`     | repo root             | Reads `examples/agent/.env` only.                                                 |
| `wait-for-server.sh` | repo root or anywhere | Hits `http://localhost:4111/api/agents`. cwd doesn't matter.                      |
| `fixtures-reset.sh`  | repo root             | Touches `examples/agent/mastra.db` + reseeds. Requires the dev server stopped.    |

Invoke them as `bash .claude/skills/builder-smoke-test/scripts/<name>.sh` from the repo root. Don't `cd` into `scripts/` first — relative path resolution will break.

`pnpm mastra:dev` must be run from `examples/agent/` (where its `package.json` is).

### How `mastra dev` reads env (important)

`mastra dev` loads `examples/agent/.env` via dotenv and **unconditionally overwrites `process.env`** with whatever's there (`packages/cli/src/commands/dev/dev.ts` ~line 384). Practical consequences:

- **`.env` is the source of truth for the running server.** Inline overrides like `AUTH_PROVIDER= pnpm mastra:dev` are silently clobbered.
- **Shell-only vars survive only if `.env` has no entry for the same key.** A blank line like `OPENAI_API_KEY=` in `.env` will overwrite a shell-exported key with empty.
- **The auth mode the server actually runs in is determined by `.env` alone.** A globally exported `AUTH_PROVIDER=workos` in your shell does NOT enable WorkOS auth in the server if `.env` doesn't have it — but it WILL leak into anything else this process runs, which is its own kind of confusing. Preflight flags this case.

### Auth modes

Two states matter:

- **auth off** — `AUTH_PROVIDER` line in `examples/agent/.env` is commented out or absent. No WorkOS, no RBAC, no FGA. This is the state for Prompts 1–6.
- **auth on** — `AUTH_PROVIDER=workos` plus `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_ORGANIZATION_ID` all present in `examples/agent/.env`. WorkOS authentication + role-based access + per-resource FGA all engage. This is the state for Prompt 7. FGA is wired through the WorkOS auth provider — it can't be disabled independently.

### Detection: run preflight before each section

```bash
# Detect current state and required vars. No mode expectation:
bash .claude/skills/builder-smoke-test/scripts/preflight.sh

# Expect a specific mode (exits non-zero on mismatch):
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect off
bash .claude/skills/builder-smoke-test/scripts/preflight.sh --expect on
```

Preflight is **detect-only**. It checks three things (repo shape, `examples/agent/node_modules`, `OPENAI_API_KEY` reachability) and optionally compares the auth mode (delegated to `scripts/auth-detect.sh`) against `--expect off|on`. It never edits `.env`, never sources rc files, never copies values around. Each failure prints a stable error code; this table tells the agent what to do.

| Error code                     | What it means                                                                                        | What the agent should do                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `not-in-mastra-repo`           | Wrong cwd — no `pnpm-workspace.yaml` + `examples/agent/` at the repo root resolved from this script  | `cd` into the user's mastra worktree (the dir with `pnpm-workspace.yaml`) and re-run.                                                                                    |
| `examples-agent-not-installed` | `examples/agent/node_modules` missing                                                                | Run `cd examples/agent && pnpm i --ignore-workspace`. Don't `pnpm i` from the repo root for this example — it uses `link:` overrides.                                    |
| `openai-key-missing`           | Neither shell nor `.env` has `OPENAI_API_KEY`; server will crash inside `OpenAIVoice` at module load | Try the rc-sourcing fallback below first. If that doesn't surface a key, ask the user to add it to `examples/agent/.env` or dictate the value.                           |
| `mode-mismatch`                | `--expect` value disagrees with what `auth-detect.sh` reports for `examples/agent/.env`              | Show the user the detected vs expected mode. Ask them to toggle `AUTH_PROVIDER` in `.env` (or do it for them if they say so). Restart `mastra dev` and re-run preflight. |
| `bad-expect-value`             | `--expect` got something other than `off` or `on`                                                    | Fix the invocation.                                                                                                                                                      |

**Default behavior:**

- **Existing `.env`** — never edit without the user's say-so. Targeted edits are allowed only when the user explicitly says "go ahead, comment that line out" or "yes, set those four vars to these values." Never write secrets into an existing `.env` without the user dictating them.
- **Missing `.env`** — if `examples/agent/.env` doesn't exist at all, you may create it with the minimum required vars (`OPENAI_API_KEY`, plus auth vars for `--expect on`). Still ask the user to dictate the actual values; don't invent or guess them.

### Sourcing the user's rc file

If `OPENAI_API_KEY` is missing from `.env` but might be in the user's shell rc (very common — keys live in `~/.zshrc` for many developers), you have **standing permission** to try sourcing it once per session, no prompt needed. Two important details:

1. **Use the right shell.** `execute_command` runs `bash` by default, but most macOS developers use `zsh` and their rc files have zsh-only syntax (`autoload`, `compdef`, etc.). Sourcing `~/.zshrc` from bash will spit out dozens of syntax errors and fail. Always wrap in `zsh -c`:

   ```bash
   zsh -c 'source ~/.zshrc 2>/dev/null && echo "OPENAI_API_KEY=${OPENAI_API_KEY:-(unset)}"'
   ```

2. **This only helps `OPENAI_API_KEY`.** `mastra dev` overwrites `process.env` from `.env` for any key present there — so for auth vars (`AUTH_PROVIDER`, `WORKOS_*`), sourcing the rc is useless. But `OPENAI_API_KEY` is the one var the skill allows to live in either place; if `.env` has no `OPENAI_API_KEY=` line at all, the shell value survives into the server.

If sourcing surfaces the key, start `mastra dev` from the same zsh session (or `zsh -c 'cd examples/agent && pnpm mastra:dev'`) so the value reaches the server. If sourcing doesn't surface it, fall back to asking the user.

When the user has fixed the issue (either themselves or via your edit), they'll tell you it's good. Restart `mastra dev` if you edited `.env` — the env file is only read at boot — then re-run preflight.

## Starting the dev server

If the server is not running on `:4111`, the Setup section starts it. The convenience helpers live under `scripts/`:

```bash
# Preflight env vars (exits non-zero if anything required is missing)
bash .claude/skills/builder-smoke-test/scripts/preflight.sh

# Start the server — NOTE: examples/agent has no `pnpm dev`. Use mastra:dev.
cd examples/agent
pnpm mastra:dev

# Poll /api/agents until 200 (60s budget). Detects mastra dev's port-bump.
bash .claude/skills/builder-smoke-test/scripts/wait-for-server.sh

# Detect auth mode purely from examples/agent/.env (because mastra dev
# overwrites process.env with .env at boot, only .env matters here).
bash .claude/skills/builder-smoke-test/scripts/auth-detect.sh
# → prints `mode=off`, `mode=on:workos`, or `mode=ambiguous` (shell-only AUTH_PROVIDER)

# Reset fixtures (only if --fixtures-reset is set)
bash .claude/skills/builder-smoke-test/scripts/fixtures-reset.sh
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

| Surface           | Endpoint                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| Builder settings  | `GET /editor/builder/settings`                                                |
| Builder infra     | `GET /editor/builder/infrastructure`                                          |
| Registries (list) | `GET /editor/builder/registries`                                              |
| Registry search   | `GET /editor/builder/registries/:registryId/search?q=…`                       |
| Registry popular  | `GET /editor/builder/registries/:registryId/popular`                          |
| Registry preview  | `GET /editor/builder/registries/:registryId/preview?repository=…&skillName=…` |
| Registry install  | `POST /editor/builder/registries/:registryId/install`                         |
| Workspace CRUD    | `GET/POST/PATCH/DELETE /stored/workspaces[/:id]`                              |
| Agent CRUD        | `GET/POST/PATCH/DELETE /stored/agents[/:id]`                                  |
| Agent star        | `PUT / DELETE /stored/agents/:id/star`                                        |
| Agent avatar      | `POST /stored/agents/:id/avatar` (owner-only)                                 |
| Skill CRUD        | `GET/POST/PATCH/DELETE /stored/skills[/:id]`                                  |
| Skill publish     | `POST /stored/skills/:id/publish`                                             |
| Skill star        | `PUT / DELETE /stored/skills/:id/star`                                        |
| Auth me           | `GET /api/auth/me` (returns logged-in user + roles + permissions)             |
| Auth refresh      | `POST /auth/refresh`                                                          |

## Builder Studio routes

| Feature                 | Route                           |
| ----------------------- | ------------------------------- |
| Agent Builder shell     | `/agent-builder`                |
| Agents (default view)   | `/agent-builder`                |
| Agent detail / edit     | `/agent-builder/agents/:id`     |
| Skills                  | `/agent-builder/skills`         |
| Library (public skills) | `/agent-builder/library`        |
| Skill detail            | `/agent-builder/skills/:id`     |
| Workspaces              | `/agent-builder/workspaces`     |
| Infrastructure (admin)  | `/agent-builder/infrastructure` |

Mobile renders a bottom-bar with the same primary entries.

## Browser smoke

Use whichever browser tool the harness has wired up (Stagehand, Chrome MCP, etc.). Don't assume a specific provider — discover what's available, then drive the same checklist in `references/ui.md`.

If the browser provider configured in `examples/agent` is Stagehand/Browserbase but no `BROWSERBASE_*` keys are set, fall back to API-only and mark UI as `⏭️ Skipped (no browser provider)`.

## Result reporting

After testing, provide:

```md
## Builder Smoke Test Results

**Date**: <date>
**Branch**: <branch>
**Commit**: <short sha>
**Server**: examples/agent @ localhost:4111
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

**Issues found**: (list any)
**Regressions**: (list any behavioral changes from a previous run)
**Warnings**: (e.g., dev-server crash on `/auth/refresh` polling, OPENAI_API_KEY required at startup)
**Skipped sections**: (list with reason)
```

## Known rough edges

The branch has accumulated minor papercuts. Note these in your report only if you hit them; don't fail the run on them:

- `pnpm clean` does not remove `examples/agent/mastra.db`. Use `--fixtures-reset` if you need a clean DB.
- Dev server can crash on hot-reload from `/auth/refresh` polling. Restart and continue.
- `OPENAI_API_KEY` is required at startup — server won't boot without it, even if you only test non-LLM surfaces.
- `mastra dev` overwrites `process.env` from `.env` at boot, so inline env overrides on the command line don't reach the server. Edit `examples/agent/.env` instead.

## Out of smoke-test scope

Some flows are documented in `references/` but are not driven by the smoke-test agent because they require server-lifecycle gymnastics that don't fit a single run:

- **Reconciliation steps 2/3/4/6** (`references/reconciliation.md`) require editing `examples/agent/src/mastra/index.ts` (changing `basePath` / `workspaceId` / config), restarting `mastra dev` multiple times, and observing drift detection or orphan archival across restarts. The smoke-test agent runs only **Step 1** (fresh-startup persistence) and **Step 5** (non-builder workspaces untouched). Run the rest by hand when changing reconciliation code.
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
- `references/stars.md` — star/unstar agents and skills, idempotency
- `references/permissions.md` — viewer/member/admin/owner gating, role expectation matrix, UI impersonation, auth-off bypass
- `references/infrastructure.md` — `/editor/builder/infrastructure` payload + admin UI
- `references/channels.md` — Slack provider visibility, connectChannel tool
- `references/ui.md` — browser checklist across Builder routes
- `references/auth.md` — WorkOS on/off, 401 behavior, authorId, mode-toggle via `.env`
- `scripts/preflight.sh` — env detection + mode expectation (`--expect off|on`)
- `scripts/wait-for-server.sh` — poll `:4111` until healthy
- `scripts/auth-detect.sh` — detect auth mode from `.env`
- `scripts/fixtures-reset.sh` — wipe + reseed `examples/agent/mastra.db`
