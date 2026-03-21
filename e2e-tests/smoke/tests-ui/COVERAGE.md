# Playwright UI Smoke Test Coverage

Tracking document for Studio/Playground E2E smoke tests.

**Test runner:** Playwright (chromium, headless)
**Test dir:** `e2e-tests/smoke/tests-ui/`
**Config:** `e2e-tests/smoke/playwright.config.ts`

## Available Fixtures

| Type       | Name                  | Notes                              |
|------------|-----------------------|------------------------------------|
| Agent      | test-agent            | Has calculator + string-transform  |
| Agent      | approval-agent        | Uses needs-approval tool           |
| Tool       | calculator            | add/subtract/multiply/divide       |
| Tool       | string-transform      | upper/lower/reverse/length         |
| Tool       | always-fails          | Throws error                       |
| Tool       | timestamp             | No input, returns time             |
| Tool       | needs-approval        | Requires user approval             |
| Workflow   | sequential-steps      | 3 linear steps                     |
| Workflow   | basic-suspend         | Suspend + resume                   |
| Workflow   | branch-workflow       | Conditional branching              |
| Workflow   | parallel-workflow     | Parallel step execution            |
| Workflow   | foreach-workflow      | Iteration over list                |
| Workflow   | retry-workflow        | Step retry on failure              |
| Workflow   | failure-workflow      | Error handling                     |
| Workflow   | nested workflows      | inner/outer/deep-nested            |
| Workflow   | 15+ more              | See src/mastra/index.ts            |
| Scorer     | completeness          | Binary 0/1 non-empty check         |
| Scorer     | length-check          | 0-1 scale by output length         |
| Processor  | uppercase             | Uppercases input messages          |
| Processor  | suffix                | Appends [processed] suffix         |
| Processor  | tripwire-test         | Aborts on "BLOCK" keyword          |
| MCP Server | test-mcp              | Test MCP server                    |

---

## Test Coverage

### Agents — `tests-ui/agents/agent-chat.spec.ts`

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Agents list page shows registered agents    | Done   |
| 2 | Agent chat page shows overview panel        | Done   |
| 3 | Send message and receive streamed response  | Done   |
| 4 | Send message with generate mode             | Done   |
| 5 | Model settings persist after reload         | Done   |
| 6 | New chat button navigates to fresh thread   | Done   |
| 7 | Thread sidebar lists previous conversations | Todo   |
| 8 | Click previous thread to reload it          | Todo   |
| 9 | Tool call displayed in chat message         | Todo   |
| 10 | Memory tab shows working memory            | Todo   |
| 11 | Approval agent triggers tool approval flow | Todo   |
| 12 | Agent overview shows correct tools list    | Todo   |

### Tools — `tests-ui/tools/tool-execution.spec.ts`

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Tools list page shows registered tools      | Done   |
| 2 | Calculator tool: add 5 + 3 = 8             | Done   |
| 3 | Calculator tool: multiply 7 * 6 = 42       | Done   |
| 4 | String-transform tool: uppercase            | Done   |
| 5 | Timestamp tool: no input required           | Done   |
| 6 | String-transform tool: reverse              | Todo   |
| 7 | Needs-approval tool: approval flow          | Todo   |
| 8 | Always-fails tool: error display            | Todo (blocked — UI shows `{}`) |

### Workflows — `tests-ui/workflows/workflow-run.spec.ts`

| # | Test                                           | Status |
|---|------------------------------------------------|--------|
| 1 | Workflows list page shows registered workflows | Done   |
| 2 | Sequential-steps: run to completion            | Done   |
| 3 | Sequential-steps: run via JSON input           | Done   |
| 4 | Basic-suspend: suspend and resume              | Done   |
| 5 | Branch-workflow: positive branch               | Done   |
| 6 | Branch-workflow: negative branch               | Done   |
| 7 | Parallel-workflow: all parallel steps succeed  | Done   |
| 8 | Foreach-workflow: processes items via JSON      | Done   |
| 9 | Retry-workflow: succeeds after retries         | Done   |
| 10 | Step detail: click step to view output        | Done   |
| 11 | Failure-workflow: failed status and error     | Done   |
| 12 | Run history: navigate to past run             | N/A (no run history UI in current studio) |

### MCP Servers — `tests-ui/mcp/` (not started)

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | MCP servers list page                       | Todo   |
| 2 | MCP server detail shows available tools     | Todo   |
| 3 | Execute MCP tool from UI                    | Todo   |

### Observability — `tests-ui/observability/` (not started)

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Traces list page loads                      | Todo   |
| 2 | Filter traces by entity type                | Todo   |
| 3 | Click trace to open detail modal            | Todo   |
| 4 | Span inspection within trace                | Todo   |
| 5 | Traces appear after agent chat              | Todo   |
| 6 | Traces appear after workflow run             | Todo   |

### Memory & Threads — `tests-ui/memory/` (not started)

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Thread list shows threads after chat        | Todo   |
| 2 | Delete a thread                             | Todo   |
| 3 | Working memory display                      | Todo   |
| 4 | Working memory editing                      | Todo   |

### Datasets — `tests-ui/datasets/` (not started, experimental)

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Datasets list page (empty state)            | Todo   |
| 2 | Create dataset with schema                  | Todo   |
| 3 | Add items to dataset                        | Todo   |
| 4 | CSV import flow                             | Todo   |
| 5 | JSON import flow                            | Todo   |
| 6 | Trigger experiment with scorer              | Todo   |
| 7 | View experiment results                     | Todo   |

### Scorers — `tests-ui/scorers/` (not started)

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Scorers list page                           | Todo   |
| 2 | Scorer detail view                          | Todo   |
| 3 | Create scorer via CMS                       | Todo   |

### Processors — `tests-ui/processors/` (not started)

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Processors list page                        | Todo   |
| 2 | Processor detail view                       | Todo   |

### Workspaces — `tests-ui/workspaces/` (not started)

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | File browser navigation                     | Todo   |
| 2 | File viewer with syntax highlighting        | Todo   |
| 3 | Skills tab: list installed skills           | Todo   |
| 4 | Search: BM25 keyword search                 | Todo   |
| 5 | Search: vector/semantic search              | Todo   |

### CMS — `tests-ui/cms/` (not started)

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Create agent wizard                         | Todo   |
| 2 | Edit agent                                  | Todo   |
| 3 | Create prompt block                         | Todo   |
| 4 | Edit prompt block                           | Todo   |

### Settings — `tests-ui/settings/` (not started)

| # | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Settings page loads                         | Todo   |

---

## Summary

| Section        | Done | Todo | Blocked |
|----------------|------|------|---------|
| Agents         | 6    | 6    | 0       |
| Tools          | 5    | 2    | 1       |
| Workflows      | 11   | 0    | 0       |
| MCP Servers    | 0    | 3    | 0       |
| Observability  | 0    | 6    | 0       |
| Memory         | 0    | 4    | 0       |
| Datasets       | 0    | 7    | 0       |
| Scorers        | 0    | 3    | 0       |
| Processors     | 0    | 2    | 0       |
| Workspaces     | 0    | 5    | 0       |
| CMS            | 0    | 4    | 0       |
| Settings       | 0    | 1    | 0       |
| **Total**      | **22** | **43** | **1** |

## Known Issues

- `always-fails` tool error is not surfaced in the UI result panel (JSON output stays `{}`). Blocked until playground renders tool errors.

## Notes

- Agent chat tests require `OPENAI_API_KEY` in `.env` for real LLM calls.
- Workflows run against the local LibSQL database, cleaned on each test run via `global-setup.ts`.
- All tests run sequentially (`workers: 1`) to avoid port/state conflicts.
