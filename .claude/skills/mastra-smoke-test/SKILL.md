---
name: mastra-smoke-test
description: Smoke test Mastra projects locally or deploy to staging/production. Tests Studio UI, agents, tools, workflows, traces, memory, and more. Supports both local development and cloud deployments.
---

# Mastra Smoke Test

Comprehensive smoke testing for Mastra projects.

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

| File                           | Purpose                      |
| ------------------------------ | ---------------------------- |
| `references/tests/*.md`        | Detailed steps for each test |
| `references/local-setup.md`    | Local dev server setup       |
| `references/cloud-deploy.md`   | Cloud deploy details         |
| `references/cloud-advanced.md` | BYOK, storage testing        |
| `references/common-errors.md`  | Troubleshooting              |
| `references/gcp-debugging.md`  | Infrastructure debugging     |
| `scripts/test-server.sh`       | Server API test script       |

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
