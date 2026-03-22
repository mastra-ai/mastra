# Playwright UI Smoke Test Coverage

Tracking document for Studio/Playground E2E smoke tests.

**Test runner:** Playwright (chromium, headless)
**Test dir:** `e2e-tests/smoke/tests-ui/`
**Config:** `e2e-tests/smoke/playwright.config.ts`

> **Legend:** &ensp; ✅ Done &ensp; ⬜ Todo &ensp; 🚫 Blocked

---

## Summary

| Section         | Progress                    | Done | Todo | Blocked |
|-----------------|-----------------------------|------|------|---------|
| Agents          | ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ | 19   | 0    | 0       |
| Tools           | ✅✅✅✅✅✅✅🚫              | 7    | 0    | 1       |
| Workflows       | ✅✅✅✅✅✅✅✅✅✅✅✅         | 12   | 0    | 0       |
| MCP Servers     | ✅✅✅                        | 3    | 0    | 0       |
| Observability   | ✅✅✅✅✅✅                  | 6    | 0    | 0       |
| Memory          | ✅✅✅✅                      | 4    | 0    | 0       |
| Datasets        | ✅✅✅✅✅✅✅✅✅✅✅          | 11   | 0    | 0       |
| Scorers         | ✅✅                          | 2    | 0    | 0       |
| Processors      | ✅✅✅                        | 3    | 0    | 0       |
| Workspaces      | ✅✅✅✅✅                    | 5    | 2    | 0       |
| CMS             | ⬜⬜⬜⬜                      | 0    | 4    | 0       |
| Settings        | ✅✅                          | 2    | 0    | 0       |
| Request Context | ✅✅                          | 2    | 0    | 0       |
| **Total**       |                               | **76** | **6** | **1** |

---

## Available Fixtures

| Type       | Name                  | Notes                              |
|------------|-----------------------|------------------------------------|
| Agent      | test-agent            | Has calculator + string-transform, memory |
| Agent      | approval-agent        | Uses needs-approval tool           |
| Agent      | helper-agent          | Sub-agent of network-agent, has string-transform |
| Agent      | network-agent         | Has memory + helper-agent sub-agent, Network mode enabled |
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
| Workspace  | test-workspace        | LocalFilesystem, fixture files via API |

---

## Test Coverage

### ✅ Agents — `tests-ui/agents/` (19/19)

#### `agent-chat.spec.ts` (11/11)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Agent chat page shows overview panel        | ✅     |
| 2 | Send message and receive streamed response  | ✅     |
| 3 | Send message with generate mode             | ✅     |
| 4 | Model settings persist after reload         | ✅     |
| 5 | New chat button navigates to fresh thread   | ✅     |
| 6 | Thread sidebar lists previous conversations | ✅     |
| 7 | Click previous thread to reload it          | ✅     |
| 8 | Tool call displayed in chat message         | ✅     |
| 9 | Memory tab shows working memory             | ✅     |
| 10 | Approval agent triggers tool approval flow | ✅     |
| 11 | Agent overview shows correct tools list    | ✅     |

#### `agent-features.spec.ts` (8/8)

|   | Test                                                        | Status |
|---|-------------------------------------------------------------|--------|
| 1 | Model settings tab shows controls and persists chat method   | ✅     |
| 2 | Tracing options tab shows JSON editor                        | ✅     |
| 3 | Network mode enabled only with sub-agents and memory         | ✅     |
| 4 | Advanced settings expand and show fields                     | ✅     |
| 5 | Agent selector switches between agents                       | ✅     |
| 6 | Network-agent overview shows sub-agents section              | ✅     |
| 7 | Agents list shows all agents with correct attached entities  | ✅     |
| 8 | Network-agent delegates to helper-agent via sub-agent call   | ✅     |

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

### Datasets — `tests-ui/datasets/datasets.spec.ts` (11/11)

|    | Test                                             | Status |
|----|--------------------------------------------------|--------|
|  1 | Datasets list page shows heading & create        | ✅     |
|  2 | Create dataset and verify it appears             | ✅     |
|  3 | Add item to dataset and view its detail          | ✅     |
|  4 | Edit dataset name and description                | ✅     |
|  5 | Edit item input and verify update                | ✅     |
|  6 | Delete item from detail panel                    | ✅     |
|  7 | Experiments tab shows empty state                | ✅     |
|  8 | Delete dataset removes it from list              | ✅     |
|  9 | JSON import: upload file and import items        | ✅     |
| 10 | CSV import: upload file and reach mapping        | ✅     |
| 11 | Trigger experiment with scorer and view results  | ✅     |

### Scorers — `tests-ui/scorers/` (2/2)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Scorers list page                           | ✅     |
| 2 | Scorer detail view                          | ✅     |

### Processors — `tests-ui/processors/` (3/3)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Processors list page                        | ✅     |
| 2 | Processor detail: run and verify result      | ✅     |
| 3 | Processor detail: tripwire triggered         | ✅     |

### Workspaces — `tests-ui/workspaces/workspaces.spec.ts` (5/7)

|   | Test                                                    | Status |
|---|---------------------------------------------------------|--------|
| 1 | Workspace page shows file browser with workspace name   | ✅     |
| 2 | File browser: navigate into directory, view file, close | ✅     |
| 3 | File browser: create and delete directory               | ✅     |
| 4 | Skills tab: shows empty state with add skill button     | ✅     |
| 5 | Skills tab: install skill from registry and remove it   | ✅     |
| 6 | Search: BM25 keyword search                             | ⬜     |
| 7 | Search: vector/semantic search                          | ⬜     |

### CMS — `tests-ui/cms/` (0/4)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Create agent wizard                         | ⬜     |
| 2 | Edit agent                                  | ⬜     |
| 3 | Create prompt block                         | ⬜     |
| 4 | Edit prompt block                           | ⬜     |

### Request Context — `tests-ui/request-context/request-context.spec.ts` (2/2)

|   | Test                                            | Status |
|---|--------------------------------------------------|--------|
| 1 | Request context page displays editor and saves JSON | ✅     |
| 2 | Request context is included in agent chat and cleared to empty after removal | ✅     |

### Settings — `tests-ui/settings/` (2/2)

|   | Test                                        | Status |
|---|---------------------------------------------|--------|
| 1 | Settings page displays configuration form   | ✅     |
| 2 | Custom header sent in API requests after save | ✅     |

---

## Known Issues

- 🚫 `always-fails` tool error is not surfaced in the UI result panel (JSON output stays `{}`). Blocked until playground renders tool errors.
- ⬜ Workspace search tests (BM25, vector) require `canBM25: true` / `canVector: true` on the workspace config. Current `test-workspace` has both disabled.

## Notes

- Agent chat tests require `OPENAI_API_KEY` in `.env` for real LLM calls.
- Workflows run against the local LibSQL database, cleaned on each test run via `global-setup.ts`.
- All tests run sequentially (`workers: 1`) to avoid port/state conflicts.
