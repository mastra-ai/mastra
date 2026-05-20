---
name: mastra-smoke-test
description: Smoke test Mastra projects locally or deploy to staging/production. Tests Studio UI, agents, tools, workflows, traces, memory, and more. Supports both local development and cloud deployments.
---

# Mastra Smoke Test

Comprehensive smoke testing for Mastra projects.

## Release smoke workflows

Use progressive disclosure: stay in this file until the workflow branches, then read only the reference for the branch you are on. `references/release-smoke.md` is a short index if you need the full map.

### Alpha release branch point

Before alpha smoke testing, identify the alpha versioning PR state. Prefer the standard Changesets release branch:

```bash
gh pr view changeset-release/main \
  --json number,title,state,url,headRefName,baseRefName,isDraft,mergeable,reviewDecision,updatedAt,mergedAt,mergeCommit
```

Expected shape:

```text
title: chore: version packages (alpha)
head: changeset-release/main
base: main
```

If that branch lookup fails, search open and recently merged PRs:

```bash
gh pr list --state open --search 'version packages alpha in:title' --limit 20
gh pr list --state merged --search 'version packages alpha in:title' --limit 20
```

Then branch:

- If the versioning PR is **open**, read `references/alpha-versioning-pr.md`.
- If the versioning PR is **merged**, read `references/alpha-publish.md`.
- If no versioning PR exists, report that and wait for the scheduled alpha versioning flow or user direction.

Do not create the alpha smoke-test project until the automatic alpha publish workflow has completed and the intended packages are installable.

### Stable release branch point

If the user is running the stable/full release workflow, read `references/stable-release-smoke.md`. If that workflow fails after some packages publish, switch to `references/stable-partial-publish-recovery.md`.

### Scope and targeted checks

After the release package is published and before running smoke tests, read `references/release-scope-discovery.md` to identify changed features. Use the default generated project for the baseline checklist, then add targeted checks for changed features the generated project does not exercise.

When scope discovery identifies a branch:

- For general changed-feature coverage, read `references/targeted-feature-smoke.md`.
- For storage/provider schema or migration changes, read `references/storage-provider-migration-smoke.md`.

## ⚠️ Mandatory Test Checklist

**Use `task_write` to track progress.** Run ALL tests unless `--test` specifies otherwise.

**Do not skip tests unless you hit an actual blocker.** "Seemed complex" or "wasn't sure" are not valid reasons. Attempt everything - only stop a test when you literally cannot proceed. Report what you tried and what blocked you.

| #   | Test              | Reference                       | When Required                |
| --- | ----------------- | ------------------------------- | ---------------------------- |
| 1   | **Setup**         | `references/tests/setup.md`     | Always                       |
| 2   | **Agents**        | `references/tests/agents.md`    | `--test agents` or full      |
| 3   | **Tools**         | `references/tests/tools.md`     | `--test tools` or full       |
| 4   | **Workflows**     | `references/tests/workflows.md` | `--test workflows` or full   |
| 5   | **Traces**        | `references/tests/traces.md`    | `--test traces` or full      |
| 6   | **Scorers**       | `references/tests/scorers.md`   | `--test scorers` or full     |
| 7   | **Memory**        | `references/tests/memory.md`    | `--test memory` or full      |
| 8   | **MCP**           | `references/tests/mcp.md`       | `--test mcp` or full         |
| 9   | **Errors**        | `references/tests/errors.md`    | `--test errors` or full      |
| 10  | **Studio Deploy** | `references/tests/studio.md`    | `--test studio` (cloud only) |
| 11  | **Server Deploy** | `references/tests/server.md`    | `--test server` (cloud only) |

### Execution Flow

1. **Read the reference file** for each test you're about to run
2. **Execute the steps** in that reference file
3. **Mark the test complete** before moving to the next

### Partial Testing (`--test`)

If `--test` is provided:

1. Always run **Setup** (step 1)
2. Run **only** the specified test(s)
3. Skip other tests

Example: `--test agents,traces` → Run steps 1, 2, and 5 only.

## Local Studio Browser Smoke

For local release smoke tests, do **both** API/curl checks and a Studio browser pass unless `--skip-browser` is explicitly requested or browser access is genuinely blocked. API checks prove runtime endpoints work; browser checks prove the Playground/Studio UI can load, submit forms, and display results.

Before opening the browser:

1. Confirm the dev server is alive on the expected port:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4111
   lsof -i :4111 || true
   ```

2. If the process died, restart it from the generated project and wait for readiness:

   ```bash
   cd "$SMOKE_DIR/smoke-project"
   pnpm run dev > "$SMOKE_DIR/logs/dev-server-browser.log" 2>&1 &

   for i in {1..60}; do
     code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4111 || true)
     [ "$code" = 200 ] && break
     sleep 1
   done
   ```

3. Use browser tools to navigate to `http://localhost:4111`. If `networkidle` times out but `domcontentloaded` succeeds and the UI is usable, continue and note the timeout.

Recommended browser task list:

```text
1. Verify Studio shell loads
2. Smoke test agent chat UI
3. Smoke test tools UI
4. Smoke test workflows UI
5. Smoke test observability, scorers, and MCP pages
6. Report browser smoke results
```

Run these page checks:

| Area         | Route                          | What to verify                                                                                                                                                           |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Studio shell | `/` or `/agents`               | Sidebar/nav visible, Mastra version visible, no crash/error overlay                                                                                                      |
| Agents       | `/agents` → agent chat         | Agent list shows expected agent, chat input is visible, sending `What's the weather in Tokyo?` returns a coherent response, tool call badge/result appears when expected |
| Tools        | `/tools` → tool detail         | Tool list shows `get-weather`, input form renders, submitting a city such as `Paris` displays JSON result with weather fields                                            |
| Workflows    | `/workflows` → workflow detail | Workflow list shows `weather-workflow`, graph/details render, running with a city such as `Berlin` completes as `success`, steps show timings/output controls            |
| Traces       | `/observability`               | Recent agent/workflow traces appear, including runs triggered during the browser pass                                                                                    |
| Scorers      | `/scorers`                     | Registered scorers appear with names/descriptions, e.g. Tool Call Accuracy, Completeness, Translation Quality                                                            |
| MCP          | `/mcps`                        | Page loads. Empty state is a pass for default templates: `No MCP Servers yet`                                                                                            |

If a browser interaction does not expose enough text in the accessibility snapshot, inspect `document.body.innerText` or take a screenshot, then record the visible evidence. Do not rely only on API output for browser smoke.

Append browser results to `$SMOKE_DIR/smoke-report.md` with a separate section, for example:

```md
## Studio Browser Smoke Results

| Area         | Result | Evidence                                                          |
| ------------ | ------ | ----------------------------------------------------------------- |
| Studio shell | PASS   | Browser loaded localhost:4111; sidebar/nav visible; version shown |
| Agents UI    | PASS   | Weather Agent chat returned Tokyo weather and displayed tool call |
| Tools UI     | PASS   | get-weather form returned Paris weather JSON                      |
| Workflows UI | PASS   | weather-workflow Berlin run completed as success                  |
| Traces UI    | PASS   | Recent agent/workflow traces listed                               |
| Scorers UI   | PASS   | Expected scorers listed                                           |
| MCP UI       | PASS   | Expected empty MCP state shown                                    |
```

Call out separately whether browser smoke was local Studio only or cloud Studio/deployed server.

---

## Usage

```text
# Full smoke test
smoke test --env local --existing-project ~/my-app
smoke test --env staging -d ~/projects -n test-app

# Partial testing
smoke test --env local --existing-project ~/my-app --test agents
smoke test --env production --existing-project ~/my-app --test studio,server,traces

# Multi-environment: same project, different targets
smoke test --env staging --existing-project ~/my-app   # Uses .mastra-project-staging.json
smoke test --env production --existing-project ~/my-app # Uses .mastra-project.json
```

## Multi-Environment Support

One project can target all environments using separate config files:

| Environment | Config File                    | What Happens                    |
| ----------- | ------------------------------ | ------------------------------- |
| Local       | N/A                            | `pnpm dev` → localhost:4111     |
| Staging     | `.mastra-project-staging.json` | Deploys to staging.mastra.cloud |
| Production  | `.mastra-project.json`         | Deploys to mastra.cloud         |

See `references/tests/setup.md` for setup details.

## Parameters

| Parameter            | Required | Default                | Description                      |
| -------------------- | -------- | ---------------------- | -------------------------------- |
| `--env`              | **Yes**  | -                      | `local`, `staging`, `production` |
| `--directory`        | \*       | `~/mastra-smoke-tests` | Parent dir for new project       |
| `--name`             | \*       | -                      | Project name                     |
| `--existing-project` | \*       | -                      | Path to existing project         |
| `--tag`              | No       | `latest`               | Version tag (e.g., `alpha`)      |
| `--pm`               | No       | `pnpm`                 | Package manager                  |
| `--llm`              | No       | `openai`               | LLM provider                     |
| `--db`               | No       | `libsql`               | Storage: `libsql`, `pg`, `turso` |
| `--test`             | No       | (full)                 | Specific test(s) to run          |
| `--browser-agent`    | No       | `false`                | Add browser agent                |
| `--skip-browser`     | No       | `false`                | Curl-only (no browser UI)        |
| `--byok`             | No       | `false`                | Test bring-your-own-key          |

\* Either `--directory` + `--name` OR `--existing-project` required

## Test Options (`--test`)

| Option      | Description              | Environments |
| ----------- | ------------------------ | ------------ |
| `agents`    | Agent page and chat      | All          |
| `tools`     | Tools page and execution | All          |
| `workflows` | Workflows page and run   | All          |
| `traces`    | Observability/traces     | All          |
| `scorers`   | Evaluation/scorers page  | All          |
| `memory`    | Conversation persistence | All          |
| `mcp`       | MCP servers page         | All          |
| `errors`    | Error handling           | All          |
| `studio`    | Studio deploy only       | Cloud        |
| `server`    | Server deploy only       | Cloud        |

## Prerequisites

**All environments:**

- Node.js + package manager
- LLM API key in env or `.env`

**Local (`--env local`):**

- Browser tools enabled (`/browser on`)

**Cloud (`--env staging/production`):**

- Mastra platform account

## Quick Start Flow

```text
1. Setup      → Read references/tests/setup.md, create/verify project
2. Start      → `pnpm run dev` (local) or deploy (cloud)
3. Test       → For each test, read its reference file and execute
4. Verify     → Check all items in reference file's checklist
5. Report     → Summarize pass/fail for each test
```

## References

| File                                             | Purpose                                  |
| ------------------------------------------------ | ---------------------------------------- |
| `references/tests/*.md`                          | Detailed steps for each mandatory test   |
| `references/release-smoke.md`                    | Short release-smoke reference index      |
| `references/alpha-versioning-pr.md`              | Open alpha versioning PR readiness       |
| `references/alpha-publish.md`                    | Merged alpha PR publish verification     |
| `references/stable-release-smoke.md`             | Stable publish and final stable smoke    |
| `references/stable-partial-publish-recovery.md`  | Partial stable publish recovery          |
| `references/release-scope-discovery.md`          | Release PR scope discovery and planning  |
| `references/targeted-feature-smoke.md`           | Targeted changed-feature smoke patterns  |
| `references/storage-provider-migration-smoke.md` | Storage/provider migration smoke pattern |
| `references/local-setup.md`                      | Local dev server setup                   |
| `references/cloud-deploy.md`                     | Cloud deploy details                     |
| `references/cloud-advanced.md`                   | BYOK, storage testing                    |
| `references/common-errors.md`                    | Troubleshooting                          |
| `references/gcp-debugging.md`                    | Infrastructure debugging                 |
| `references/architecture.md`                     | Smoke-test architecture notes            |
| `references/environment-variables.md`            | Environment variable setup               |
| `scripts/test-server.sh`                         | Server API test script                   |
| `scripts/discover-release-scope.sh`              | Release PR scope discovery               |
| `scripts/check-versioning-pr.sh`                 | Alpha versioning PR spot-check helper    |

## Platform Dashboards

- **Production**: `https://projects.mastra.ai`
- **Staging**: `https://projects.staging.mastra.ai`

> For Gateway API testing (memory, threads, BYOK via gateway), use `platform-smoke-test`.

## Result Reporting

After testing, provide:

```md
## Smoke Test Results

**Environment**: local/staging/production
**Project**: <name>

| Test   | Status | Notes |
| ------ | ------ | ----- |
| Setup  | ✅/❌  |       |
| Agents | ✅/❌  |       |
| Tools  | ✅/❌  |       |
| ...    |        |       |

**Issues Found**: (list any)
**Warnings**: (list any deploy/runtime warnings)
**Skipped Tests**: (list with reason - e.g., "Server Deploy - not applicable in local environment")
```
