# Playwright UI Smoke Test Coverage

Tracking document for Studio/Playground E2E smoke tests.

**Test runner:** Playwright (chromium, headless)
**Test dir:** `e2e-tests/smoke/tests-ui/`
**Config:** `e2e-tests/smoke/playwright.config.ts`

> **Legend:** &ensp; ✅ Done &ensp; ⬜ Todo &ensp; 🚫 Blocked

---

## Summary

| Section       | Progress              | Done | Todo | Blocked |
|---------------|-----------------------|------|------|---------|
| Agents        | ✅✅✅✅✅✅✅✅✅✅✅✅ | 12   | 0    | 0       |
| Tools         | ✅✅✅✅✅✅✅🚫      | 7    | 0    | 1       |
| Workflows     | ✅✅✅✅✅✅✅✅✅✅✅✅ | 12   | 0    | 0       |
| MCP Servers   | ✅✅✅                | 3    | 0    | 0       |
| Observability | ✅✅✅✅✅✅          | 6    | 0    | 0       |
| Memory        | ✅✅✅✅              | 4    | 0    | 0       |
| Datasets      | ⬜⬜⬜⬜⬜⬜⬜        | 0    | 7    | 0       |
| Scorers       | ✅✅                  | 2    | 0    | 0       |
| Processors    | ⬜⬜                  | 0    | 2    | 0       |
| Workspaces    | ⬜⬜⬜⬜⬜            | 0    | 5    | 0       |
| CMS           | ⬜⬜⬜⬜              | 0    | 4    | 0       |
| Settings      | ✅✅                  | 2    | 0    | 0       |
| **Total**     |                       | **48** | **16** | **1** |

---

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

### ✅ Agents — `tests-ui/agents/agent-chat.spec.ts` (12/12)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Agents list page shows registered agents    | ✅     |
| 2 | Agent chat page shows overview panel        | ✅     |
| 3 | Send message and receive streamed response  | ✅     |
| 4 | Send message with generate mode             | ✅     |
| 5 | Model settings persist after reload         | ✅     |
| 6 | New chat button navigates to fresh thread   | ✅     |
| 7 | Thread sidebar lists previous conversations | ✅     |
| 8 | Click previous thread to reload it          | ✅     |
| 9 | Tool call displayed in chat message         | ✅     |
| 10 | Memory tab shows working memory            | ✅     |
| 11 | Approval agent triggers tool approval flow | ✅     |
| 12 | Agent overview shows correct tools list    | ✅     |

### ✅ Workflows — `tests-ui/workflows/workflow-run.spec.ts` (12/12)

|   | Test                                           | Status |
|---|------------------------------------------------|--------|
| 1 | Workflows list page shows registered workflows | ✅     |
| 2 | Sequential-steps: run to completion            | ✅     |
| 3 | Sequential-steps: run via JSON input           | ✅     |
| 4 | Basic-suspend: suspend and resume              | ✅     |
| 5 | Branch-workflow: positive branch               | ✅     |
| 6 | Branch-workflow: negative branch               | ✅     |
| 7 | Parallel-workflow: all parallel steps succeed  | ✅     |
| 8 | Foreach-workflow: processes items via JSON      | ✅     |
| 9 | Retry-workflow: succeeds after retries         | ✅     |
| 10 | Step detail: click step to view output        | ✅     |
| 11 | Failure-workflow: failed status and error     | ✅     |
| 12 | Run history: expand panel, view past runs     | ✅     |

### Tools — `tests-ui/tools/tool-execution.spec.ts` (7/8)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Tools list page shows registered tools      | ✅     |
| 2 | Calculator tool: add 5 + 3 = 8             | ✅     |
| 3 | Calculator tool: multiply 7 * 6 = 42       | ✅     |
| 4 | String-transform tool: uppercase            | ✅     |
| 5 | Timestamp tool: no input required           | ✅     |
| 6 | String-transform tool: reverse              | ✅     |
| 7 | Needs-approval tool: executes without gate  | ✅     |
| 8 | Always-fails tool: error display            | 🚫     |

### ✅ MCP Servers — `tests-ui/mcp/mcp-servers.spec.ts` (3/3)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | MCP servers list page shows registered servers | ✅  |
| 2 | MCP server detail shows available tools     | ✅     |
| 3 | Execute MCP tool from UI                    | ✅     |

### ✅ Observability — `tests-ui/observability/traces.spec.ts` (6/6)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Traces list page loads with trace entries    | ✅     |
| 2 | Filter traces by entity type                | ✅     |
| 3 | Click trace to open detail dialog            | ✅     |
| 4 | Span inspection within trace                | ✅     |
| 5 | Traces appear after workflow run             | ✅     |
| 6 | Traces appear after agent chat              | ✅     |

### Memory & Threads — `tests-ui/memory/memory-threads.spec.ts` (4/4)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Thread list shows threads after chat        | ✅     |
| 2 | Delete a thread                             | ✅     |
| 3 | Working memory display                      | ✅     |
| 4 | Working memory editing                      | ✅     |

### Datasets — `tests-ui/datasets/` (0/7)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Datasets list page (empty state)            | ⬜     |
| 2 | Create dataset with schema                  | ⬜     |
| 3 | Add items to dataset                        | ⬜     |
| 4 | CSV import flow                             | ⬜     |
| 5 | JSON import flow                            | ⬜     |
| 6 | Trigger experiment with scorer              | ⬜     |
| 7 | View experiment results                     | ⬜     |

### Scorers — `tests-ui/scorers/` (2/2)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Scorers list page                           | ✅     |
| 2 | Scorer detail view                          | ✅     |

### Processors — `tests-ui/processors/` (0/2)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Processors list page                        | ⬜     |
| 2 | Processor detail view                       | ⬜     |

### Workspaces — `tests-ui/workspaces/` (0/5)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | File browser navigation                     | ⬜     |
| 2 | File viewer with syntax highlighting        | ⬜     |
| 3 | Skills tab: list installed skills           | ⬜     |
| 4 | Search: BM25 keyword search                 | ⬜     |
| 5 | Search: vector/semantic search              | ⬜     |

### CMS — `tests-ui/cms/` (0/4)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Create agent wizard                         | ⬜     |
| 2 | Edit agent                                  | ⬜     |
| 3 | Create prompt block                         | ⬜     |
| 4 | Edit prompt block                           | ⬜     |

### Settings — `tests-ui/settings/` (2/2)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Settings page displays configuration form   | ✅     |
| 2 | Custom header sent in API requests after save | ✅     |

---

## Known Issues

- 🚫 `always-fails` tool error is not surfaced in the UI result panel (JSON output stays `{}`). Blocked until playground renders tool errors.

## Notes

- Agent chat tests require `OPENAI_API_KEY` in `.env` for real LLM calls.
- Workflows run against the local LibSQL database, cleaned on each test run via `global-setup.ts`.
- All tests run sequentially (`workers: 1`) to avoid port/state conflicts.
