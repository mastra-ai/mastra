---
name: builder-smoke-test
description: Smoke test the Agent Builder feature branch end-to-end against examples/agent on localhost:4111. Covers workspace reconciliation, stored agents/skills CRUD, ownership, visibility, stars, registry/library Copy flow, picker allowlists, model policy, RBAC role preview, builder defaults, infrastructure diagnostics, channels, and Studio + Agent Builder UI. Trigger when validating the agent-builder feature branch, PRs that touch packages/server, packages/playground, packages/playground-ui agent-builder routes, or builder EE code paths.
---

# Builder Smoke Test

End-to-end smoke testing of the Agent Builder feature set against `examples/agent` running on `localhost:4111`.

This skill is for **branch QA** — it complements the release-time `mastra-smoke-test`. It exercises the Builder EE surface (stored entities, RBAC, registry, infra, channels) rather than a freshly scaffolded project.

## ⚠️ Mandatory Test Checklist

**Use `task_write` to track progress.** Run ALL sections unless `--test` or `--scope` narrows the run.

**Do not skip sections unless you hit an actual blocker.** "Seemed complex" or "I'll come back to it" are not valid reasons. Attempt every step — only stop when you literally cannot proceed. Report what you tried and what blocked you.

| #   | Section                | Reference                        | When required                                                               |
| --- | ---------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| 1   | **Setup**              | `references/setup.md`            | Always                                                                      |
| 2   | **Workspace**          | `references/workspace.md`        | `--test workspace` or full                                                  |
| 3   | **Reconciliation**     | `references/reconciliation.md`   | `--test reconciliation` or full (long-running, optional during quick smoke) |
| 4   | **Defaults**           | `references/defaults.md`         | `--test defaults` or full                                                   |
| 5   | **Model Policy**       | `references/model-policy.md`     | `--test model-policy` or full                                               |
| 6   | **Skills**             | `references/skills.md`           | `--test skills` or full                                                     |
| 7   | **Registry**           | `references/registry.md`         | `--test registry` or full                                                   |
| 8   | **Agents**             | `references/agents.md`           | `--test agents` or full                                                     |
| 9   | **Picker Allowlists**  | `references/picker-allowlist.md` | `--test pickers` or full                                                    |
| 10  | **Stars**              | `references/stars.md`            | `--test stars` or full                                                      |
| 11  | **Permissions / RBAC** | `references/permissions.md`      | `--test permissions` or full                                                |
| 12  | **Infrastructure**     | `references/infrastructure.md`   | `--test infrastructure` or full                                             |
| 13  | **Channels**           | `references/channels.md`         | `--test channels` or full                                                   |
| 14  | **UI**                 | `references/ui.md`               | `--test ui` or full                                                         |
| 15  | **Auth**               | `references/auth.md`             | `--test auth` or `--auth on`                                                |

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

# Skip the browser pass (API-only run)
/builder-smoke-test --skip-browser
```

## Parameters

| Parameter          | Description                                                                                                | Default        |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | -------------- |
| `--test`           | Comma-separated section names (see table above).                                                           | (all sections) |
| `--scope`          | Named group of sections (`rbac`, `skills`, `agents`, `infra`, `ui`, `quick`). Combinable with `--test`.    | (none)         |
| `--auth`           | `on`, `off`, or `auto`. `auto` enables the Auth section iff `WORKOS_CLIENT_ID` + `WORKOS_API_KEY` are set. | `auto`         |
| `--fixtures-reset` | Stop the dev server, wipe `examples/agent/mastra.db`, restart, restore the seeded public skills.           | `false`        |
| `--clean`          | Delete test entities (smoke-test workspaces / agents / skills) at the end of each section.                 | `false`        |
| `--skip-browser`   | Run only API/`curl` checks. UI section is skipped.                                                         | `false`        |

If `--auth auto` and no WorkOS env vars are present, the Auth section is auto-skipped and reported as `⏭️ Skipped (no WORKOS_* env vars)`.

## Prerequisites

- Working tree on the agent-builder feature branch.
- `OPENAI_API_KEY` set. `examples/agent` instantiates `OpenAIVoice` at module load — without a key the server crashes inside `OpenAIVoice` (`voice/openai/dist/index.js`: `Error: No API key provided for speech model`) before HTTP ever opens.
- For non-auth runs, set `MASTRA_FGA_ENABLED=false` whenever `AUTH_PROVIDER=workos` is also set (FGA auto-enables in that combo and throws `FGADeniedError` on tool calls).
- Optional: `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_ORGANIZATION_ID` for auth tests.
- Optional: `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` if the registered browser provider is Stagehand/Browserbase.
- Whichever browser MCP/tool the harness has access to. If neither is available, run with `--skip-browser` and report UI as `⏭️ Skipped (no browser tool)`.

### Env-var resolution order

The smoke scripts (`preflight.sh`, `auth-detect.sh`) look for each variable in this order, first non-empty wins. They never source or mutate your environment.

1. Already-exported shell env (`echo $VAR`).
2. `$BUILDER_SMOKE_RC` — optional path to a personal env file the script will `grep` (not source). Keeps team-specific secrets out of `examples/agent/.env`.
3. `examples/agent/.env`.
4. Repo-root `.env`, then `.env.local`.

Run preflight first:

```bash
bash .claude/skills/builder-smoke-test/scripts/preflight.sh
```

It exits non-zero if any required var is missing and prints exactly where each found one came from.

### Agent: how to handle missing env vars

**You have explicit permission to `source` the user's shell rc on their behalf** when preflight reports missing vars — the user almost certainly has their API keys exported in `~/.zshrc` or `~/.bashrc` already, and asking them to paste a raw key value is the wrong move.

Recommended order when preflight fails:

1. **Source the user's rc, then re-run preflight in the same shell.** Do this ONCE per session, in the same terminal you'll launch `pnpm mastra:dev` from. The rc may run side effects (`nvm`, `starship`, etc.) — that's fine for a smoke run, just don't loop it.

   ```bash
   source ~/.zshrc 2>/dev/null || source ~/.bashrc 2>/dev/null || true
   bash .claude/skills/builder-smoke-test/scripts/preflight.sh
   ```

2. If sourcing didn't pick the var up (key lives somewhere unusual), tell the user which var is still missing and offer three options: export it manually, add it to `examples/agent/.env`, or point `$BUILDER_SMOKE_RC` at an env file.

3. **Do not prompt the user for raw key values.** They already have the keys somewhere — your job is to find them, not extract them.

Once preflight passes in a given shell, the same shell can launch `pnpm mastra:dev` directly and `examples/agent` will inherit the vars.

### Agent: how to handle the `AUTH_PROVIDER=workos` + `MASTRA_FGA_ENABLED` cross-check

Preflight warns when `AUTH_PROVIDER=workos` is set but `MASTRA_FGA_ENABLED` is not. `examples/agent/.env` keeps `AUTH_PROVIDER=workos` as a long-lived value — the user routinely toggles between auth-off and auth-on runs by flipping FGA, not by removing the provider.

When this warning fires, **just resolve it without asking**:

- **For any `--auth off` run (Prompts 1–6 by default):** add `MASTRA_FGA_ENABLED=false` to `examples/agent/.env` if it isn't there. This is the canonical workaround — documented in the prerequisites, gitignored, and persistent across runs. Then re-run preflight; the warning disappears.
- **For Prompt 7 (`--auth on`):** the user manages auth env themselves per Prompt 7's text. Leave `.env` alone, trust their setup, and proceed.

This is **not** real auth-off. With `AUTH_PROVIDER=workos` still in `.env`, the server is auth-on at the WorkOS layer; setting `MASTRA_FGA_ENABLED=false` only disables FGA tool-call enforcement. That's an acceptable approximation for the non-auth prompts because (a) no WorkOS session means requests are unauthenticated and (b) the FGA bypass prevents `FGADeniedError`s from masking real failures. Flag this in your run report under "Configuration" — don't block on it.

If you want pedantically pure auth-off semantics (no `AUTH_PROVIDER` at all), that's the user's call — surface the option in your report but don't unilaterally remove it from `.env`.

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

# Detect auth state from env vars (respects $BUILDER_SMOKE_RC + project .env files)
bash .claude/skills/builder-smoke-test/scripts/auth-detect.sh
# → prints `auth=on` or `auth=off`

# Reset fixtures (only if --fixtures-reset is set)
bash .claude/skills/builder-smoke-test/scripts/fixtures-reset.sh
```

`wait-for-server.sh` probes `/api/agents` — not `/` — because the SPA shell can return 200 before the API mounts. If it reports the server is up on `:4112`+ instead of `:4111`, `mastra dev` fell through to the next port; stop, free `:4111`, and restart. Continuing on a non-default port silently breaks every curl in every reference.

## API base URL

All API calls use `http://localhost:4111/api`.

```bash
BASE=http://localhost:4111/api
```

## Quick reference: key endpoints

| Surface             | Endpoint                                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| Builder settings    | `GET /editor/builder/settings`                                                |
| Builder infra       | `GET /editor/builder/infrastructure`                                          |
| Registries (list)   | `GET /editor/builder/registries`                                              |
| Registry search     | `GET /editor/builder/registries/:registryId/search?q=…`                       |
| Registry popular    | `GET /editor/builder/registries/:registryId/popular`                          |
| Registry preview    | `GET /editor/builder/registries/:registryId/preview?repository=…&skillName=…` |
| Registry install    | `POST /editor/builder/registries/:registryId/install`                         |
| Workspace CRUD      | `GET/POST/PATCH/DELETE /stored/workspaces[/:id]`                              |
| Agent CRUD          | `GET/POST/PATCH/DELETE /stored/agents[/:id]`                                  |
| Agent star          | `PUT / DELETE /stored/agents/:id/star`                                        |
| Agent avatar        | `POST /stored/agents/:id/avatar` (owner-only)                                 |
| Skill CRUD          | `GET/POST/PATCH/DELETE /stored/skills[/:id]`                                  |
| Skill publish       | `POST /stored/skills/:id/publish`                                             |
| Skill star          | `PUT / DELETE /stored/skills/:id/star`                                        |
| Role preview header | `X-Mastra-Role-Preview: <role>` (admin-only; see `references/permissions.md`) |
| Auth refresh        | `POST /auth/refresh`                                                          |

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

- Viewer role may still see create/edit buttons on some sub-pages (route-level RBAC is solid; component-level gating in progress).
- "My agents" page lacks visibility badges.
- `pnpm clean` does not remove `examples/agent/mastra.db`. Use `--fixtures-reset` if you need a clean DB.
- Dev server can crash on hot-reload from `/auth/refresh` polling. Restart and continue.
- `OPENAI_API_KEY` is required at startup — server won't boot without it, even if you only test non-LLM surfaces.
- `AUTH_PROVIDER=workos` auto-enables FGA; set `MASTRA_FGA_ENABLED=false` to opt out.

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
- `references/permissions.md` — viewer/member/admin gating, role preview, auth-off bypass
- `references/infrastructure.md` — `/editor/builder/infrastructure` payload + admin UI
- `references/channels.md` — Slack provider visibility, connectChannel tool
- `references/ui.md` — browser checklist across Builder routes
- `references/auth.md` — WorkOS on/off, 401 behavior, authorId, FGA workaround
- `scripts/wait-for-server.sh` — poll `:4111` until healthy
- `scripts/auth-detect.sh` — detect WorkOS env vars
- `scripts/fixtures-reset.sh` — wipe + reseed `examples/agent/mastra.db`
