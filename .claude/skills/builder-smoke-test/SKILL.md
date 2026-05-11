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

| #   | Section                | Reference                          | When required                                       |
| --- | ---------------------- | ---------------------------------- | --------------------------------------------------- |
| 1   | **Setup**              | `references/setup.md`              | Always                                              |
| 2   | **Workspace**          | `references/workspace.md`          | `--test workspace` or full                          |
| 3   | **Reconciliation**     | `references/reconciliation.md`     | `--test reconciliation` or full (long-running, optional during quick smoke) |
| 4   | **Defaults**           | `references/defaults.md`           | `--test defaults` or full                           |
| 5   | **Model Policy**       | `references/model-policy.md`       | `--test model-policy` or full                       |
| 6   | **Skills**             | `references/skills.md`             | `--test skills` or full                             |
| 7   | **Registry**           | `references/registry.md`           | `--test registry` or full                           |
| 8   | **Agents**             | `references/agents.md`             | `--test agents` or full                             |
| 9   | **Picker Allowlists**  | `references/picker-allowlist.md`   | `--test pickers` or full                            |
| 10  | **Stars**              | `references/stars.md`              | `--test stars` or full                              |
| 11  | **Permissions / RBAC** | `references/permissions.md`        | `--test permissions` or full                        |
| 12  | **Infrastructure**     | `references/infrastructure.md`     | `--test infrastructure` or full                     |
| 13  | **Channels**           | `references/channels.md`           | `--test channels` or full                           |
| 14  | **UI**                 | `references/ui.md`                 | `--test ui` or full                                 |
| 15  | **Auth**               | `references/auth.md`               | `--test auth` or `--auth on`                        |

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

| Scope          | Includes                                                  |
| -------------- | --------------------------------------------------------- |
| `rbac`         | permissions, auth                                         |
| `skills`       | skills, registry, defaults                                |
| `agents`       | agents, pickers, defaults, model-policy                   |
| `infra`        | infrastructure, channels, reconciliation                  |
| `ui`           | ui                                                        |
| `quick`        | workspace, skills, agents, stars, ui (skips long-running) |

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

| Parameter           | Description                                                                                                  | Default              |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------- |
| `--test`            | Comma-separated section names (see table above).                                                             | (all sections)       |
| `--scope`           | Named group of sections (`rbac`, `skills`, `agents`, `infra`, `ui`, `quick`). Combinable with `--test`.      | (none)               |
| `--auth`            | `on`, `off`, or `auto`. `auto` enables the Auth section iff `WORKOS_CLIENT_ID` + `WORKOS_API_KEY` are set.   | `auto`               |
| `--fixtures-reset`  | Stop the dev server, wipe `examples/agent/mastra.db`, restart, restore the seeded public skills.             | `false`              |
| `--clean`           | Delete test entities (smoke-test workspaces / agents / skills) at the end of each section.                   | `false`              |
| `--skip-browser`    | Run only API/`curl` checks. UI section is skipped.                                                           | `false`              |

If `--auth auto` and no WorkOS env vars are present, the Auth section is auto-skipped and reported as `⏭️ Skipped (no WORKOS_* env vars)`.

## Prerequisites

- Working tree on the agent-builder feature branch.
- `OPENAI_API_KEY` set (the example agent requires it at startup).
- Optional: `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_ORGANIZATION_ID` for auth tests.
- Optional: `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` if the registered browser provider is Stagehand/Browserbase.
- Whichever browser MCP/tool the harness has access to. If neither is available, run with `--skip-browser` and report UI as `⏭️ Skipped (no browser tool)`.

### Known auth gotcha

Setting `AUTH_PROVIDER=workos` auto-enables FGA, which throws `FGADeniedError` on tool execution. If you hit FGA errors during a non-auth run, set `MASTRA_FGA_ENABLED=false` in `examples/agent/.env` or unset `AUTH_PROVIDER` for the run.

## Starting the dev server

If the server is not running on `:4111`, the Setup section starts it. The convenience helpers live under `scripts/`:

```bash
# Poll until :4111 responds 200 (60s budget)
bash .claude/skills/builder-smoke-test/scripts/wait-for-server.sh

# Detect auth state from env vars
bash .claude/skills/builder-smoke-test/scripts/auth-detect.sh
# → prints `auth=on` or `auth=off`

# Reset fixtures (only if --fixtures-reset is set)
bash .claude/skills/builder-smoke-test/scripts/fixtures-reset.sh
```

## API base URL

All API calls use `http://localhost:4111/api`.

```bash
BASE=http://localhost:4111/api
```

## Quick reference: key endpoints

| Surface             | Endpoint                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Builder settings    | `GET /editor/builder/settings`                                                            |
| Builder infra       | `GET /editor/builder/infrastructure`                                                      |
| Registries (list)   | `GET /editor/builder/registries`                                                          |
| Registry search     | `GET /editor/builder/registries/:registryId/search?q=…`                                   |
| Registry popular    | `GET /editor/builder/registries/:registryId/popular`                                      |
| Registry preview    | `GET /editor/builder/registries/:registryId/preview?repository=…&skillName=…`             |
| Registry install    | `POST /editor/builder/registries/:registryId/install`                                     |
| Workspace CRUD      | `GET/POST/PATCH/DELETE /stored/workspaces[/:id]`                                          |
| Agent CRUD          | `GET/POST/PATCH/DELETE /stored/agents[/:id]`                                              |
| Agent star          | `PUT / DELETE /stored/agents/:id/star`                                                    |
| Agent avatar        | `POST /stored/agents/:id/avatar` (owner-only)                                             |
| Skill CRUD          | `GET/POST/PATCH/DELETE /stored/skills[/:id]`                                              |
| Skill publish       | `POST /stored/skills/:id/publish`                                                         |
| Skill star          | `PUT / DELETE /stored/skills/:id/star`                                                    |
| Role preview header | `X-Mastra-Role-Preview: <role>` (admin-only; see `references/permissions.md`)             |
| Auth refresh        | `POST /auth/refresh`                                                                      |

## Builder Studio routes

| Feature                | Route                                |
| ---------------------- | ------------------------------------ |
| Agent Builder shell    | `/agent-builder`                     |
| Agents (default view)  | `/agent-builder`                     |
| Agent detail / edit    | `/agent-builder/agents/:id`          |
| Skills                 | `/agent-builder/skills`              |
| Library (public skills)| `/agent-builder/library`             |
| Skill detail           | `/agent-builder/skills/:id`          |
| Workspaces             | `/agent-builder/workspaces`          |
| Infrastructure (admin) | `/agent-builder/infrastructure`      |

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

| #  | Section            | Status | Notes                          |
| -- | ------------------ | ------ | ------------------------------ |
| 1  | Setup              | ✅/❌  |                                |
| 2  | Workspace          | ✅/❌  |                                |
| 3  | Reconciliation     | ✅/❌/⏭️ |                                |
| 4  | Defaults           | ✅/❌  |                                |
| 5  | Model Policy       | ✅/❌  |                                |
| 6  | Skills             | ✅/❌  |                                |
| 7  | Registry           | ✅/❌  |                                |
| 8  | Agents             | ✅/❌  |                                |
| 9  | Pickers            | ✅/❌  |                                |
| 10 | Stars              | ✅/❌  |                                |
| 11 | Permissions / RBAC | ✅/❌  |                                |
| 12 | Infrastructure     | ✅/❌  |                                |
| 13 | Channels           | ✅/❌  |                                |
| 14 | UI                 | ✅/❌/⏭️ |                                |
| 15 | Auth               | ✅/❌/⏭️ | (skipped if no WORKOS_* vars)  |

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
