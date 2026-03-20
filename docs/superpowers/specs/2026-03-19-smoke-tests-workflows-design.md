# Smoke Tests: Workflow Coverage — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Phase 1 — Workflow smoke tests via API server

## Overview

Post-release smoke tests that run locally against `alpha`-tagged Mastra packages. The tests exercise workflow features end-to-end through the HTTP API server, using `mastra build` + `mastra start` for the full production server path.

This is Phase 1 (workflows). Future phases will add agents, scorers, datasets, and other primitives using the same infrastructure.

## Decisions

| Decision         | Choice                                  | Rationale                                                  |
| ---------------- | --------------------------------------- | ---------------------------------------------------------- |
| Project setup    | Pre-built project in `e2e-tests/smoke/` | Reliable, fast iteration, follows existing patterns        |
| Storage          | LibSQL (file-based)                     | Real persistence without Docker, needed for run management |
| Test client      | Raw `fetch`                             | Tests the server contract directly, no SDK layer           |
| Server lifecycle | Single server, all workflows at boot    | Fast, simple, mirrors real usage                           |
| Server startup   | `mastra build` + `mastra start`         | Tests the full production path                             |
| Package versions | `alpha` dist-tag                        | Tests against pre-release packages                         |

## Project Structure

```
e2e-tests/smoke/
├── package.json              # standalone, not in pnpm workspace
├── vitest.config.ts
├── tsconfig.json
├── .env                      # minimal (storage configured in code)
├── src/
│   └── mastra/
│       ├── index.ts          # Mastra instance with LibSQL + all workflows
│       └── workflows/
│           ├── basic.ts
│           ├── control-flow.ts
│           ├── suspend-resume.ts
│           ├── state.ts
│           ├── nested.ts
│           └── error-handling.ts
└── tests/
    ├── setup.ts              # globalSetup: build, start server, teardown
    ├── utils.ts              # fetchApi(), streamApi() helpers
    └── workflows/
        ├── basic.test.ts
        ├── control-flow.test.ts
        ├── suspend-resume.test.ts
        ├── state.test.ts
        ├── nested.test.ts
        ├── error-handling.test.ts
        ├── run-management.test.ts
        └── streaming.test.ts
```

## Package Dependencies

**`package.json`** (standalone, not in pnpm workspace):

```json
{
  "dependencies": {
    "@mastra/core": "alpha",
    "@mastra/libsql": "alpha"
  },
  "devDependencies": {
    "mastra": "alpha",
    "vitest": "latest",
    "typescript": "latest",
    "zod": "latest",
    "get-port": "^5.1.1"
  }
}
```

## Server Lifecycle

Managed in `tests/setup.ts` as Vitest `globalSetup`:

1. **Build:** Run `npx mastra build` as a child process, wait for completion
2. **Start:** Spawn `npx mastra start` with `PORT` set to a random port (via `get-port`)
3. **Poll:** Hit `GET /api/workflows` until the server responds (timeout after ~30s)
4. **Provide:** Export `baseUrl` to tests via `vitest.provide()`
5. **Teardown:** Send SIGTERM to the `mastra start` process, clean up `test.db` and `.mastra/output/`

## RunId Strategy

Most workflow operations (resume, restart, time-travel, run queries) require a `runId`. Strategy:

- **Generate client-side:** Tests generate `runId` via `crypto.randomUUID()` and pass it as a query parameter.
- **Example:** `POST /api/workflows/my-workflow/start-async?runId=<uuid>`
- `start-async` accepts `runId` optionally (generates one if omitted). All other endpoints (`stream`, `resume-async`, `resume-stream`, `restart-async`, `time-travel-async`) **require** `runId` and return 400 without it.
- By always providing `runId` client-side, tests have a consistent pattern across all endpoints.

## Test Configuration

**Vitest config (`vitest.config.ts`):**

- `testTimeout: 30000` — workflows with retries, loops, and suspend/resume need time
- `sequence.concurrent: false` — tests run sequentially to avoid run interference
- `globalSetup: './tests/setup.ts'`

**Test isolation:** Each test generates its own unique `runId`, so tests don't interfere with each other's runs. The LibSQL database is cleaned up on teardown (delete `test.db` file).

## Environment

**`.env`** contents (minimal for workflow-only tests):

```
# LibSQL storage is configured in src/mastra/index.ts via file:test.db
# No API keys needed for workflow-only smoke tests
```

Storage URL (`file:test.db`) is hardcoded in `src/mastra/index.ts`, not in `.env`. The `PORT` env var is set dynamically by the globalSetup.

## Workflow Definitions

### `basic.ts`

| Workflow            | Features Tested                                   |
| ------------------- | ------------------------------------------------- |
| `sequential-steps`  | 3 chained steps, data flows through each          |
| `schema-validation` | Input/output Zod schemas, invalid input rejection |
| `map-between-steps` | `.map()` to transform data between steps          |

### `control-flow.ts`

| Workflow            | Features Tested                            |
| ------------------- | ------------------------------------------ |
| `branch-workflow`   | `.branch()` with 2-3 conditional paths     |
| `parallel-workflow` | `.parallel()` with 3 concurrent steps      |
| `dowhile-workflow`  | `.dowhile()` loop with counter condition   |
| `dountil-workflow`  | `.dountil()` loop with threshold condition |
| `foreach-workflow`  | `.foreach()` over array with concurrency   |

### `suspend-resume.ts`

| Workflow           | Features Tested                                    |
| ------------------ | -------------------------------------------------- |
| `basic-suspend`    | Step suspends with payload, resume with data       |
| `parallel-suspend` | Suspend inside `.parallel()`, resume with labels   |
| `loop-suspend`     | Suspend inside `.dowhile()`, resume continues loop |

### `state.ts`

| Workflow            | Features Tested                              |
| ------------------- | -------------------------------------------- |
| `stateful-workflow` | State schema, `setState()` across steps      |
| `initial-state`     | Start with `initialState`, steps read/modify |

### `nested.ts`

| Workflow                            | Features Tested                      |
| ----------------------------------- | ------------------------------------ |
| `inner-workflow` + `outer-workflow` | Workflow as step, data flows through |

### `error-handling.ts`

| Workflow              | Features Tested                                                           |
| --------------------- | ------------------------------------------------------------------------- |
| `retry-workflow`      | Step fails N times then succeeds, `retries` config                        |
| `failure-workflow`    | Step always throws, run fails with error info                             |
| `cancelable-workflow` | Uses `.sleep()` step (long duration) so it can be cancelled mid-execution |

> **Note:** `run-management.test.ts` and `streaming.test.ts` do not have their own workflow definition files. They reuse workflows from other files (`sequential-steps` from `basic.ts`, `basic-suspend` from `suspend-resume.ts`, `cancelable-workflow` from `error-handling.ts`).

## Test Plan

### `basic.test.ts`

- `start-async` sequential-steps — verify final result contains all step outputs
- `start-async` schema-validation with invalid input — verify error response
- `start-async` schema-validation with valid input — verify output matches schema
- `start-async` map-between-steps — verify mapped data flows correctly

### `control-flow.test.ts`

- `start-async` branch-workflow with input for branch A — verify branch A ran, B didn't
- Same for branch B
- `start-async` parallel-workflow — verify all 3 results present
- `start-async` dowhile-workflow — verify expected iteration count
- `start-async` dountil-workflow — verify accumulated result
- `start-async` foreach-workflow — verify each item processed

### `suspend-resume.test.ts`

- `start-async` basic-suspend — verify status `suspended` with payload
- `resume-async` basic-suspend — verify completes with resumed data
- `start-async` parallel-suspend — verify suspended with label info
- `resume-async` parallel-suspend with label — verify correct branch resumed
- `start-async` + `resume-async` loop-suspend — verify loop continues

### `state.test.ts`

- `start-async` stateful-workflow — verify final state reflects all `setState()` calls
- `start-async` initial-state with `initialState` body — verify steps received and modified it

### `nested.test.ts`

- `start-async` outer-workflow — verify inner executed and result flows to outer

### `error-handling.test.ts`

- `start-async` retry-workflow — verify succeeds after retries
- `start-async` failure-workflow — verify status `failed` with error details

### `run-management.test.ts`

- `GET /api/workflows` — all workflows listed
- `GET /api/workflows/sequential-steps` — single workflow metadata
- `start-async` then `GET .../runs` — run appears in list
- `GET .../runs/:runId` — run details with status/result
- `DELETE .../runs/:runId` — deletion works
- `start-async` cancelable-workflow then `POST .../runs/:runId/cancel` — cancellation of sleep-based workflow
- `time-travel-async` — re-execute from specific step
- `restart-async` — restart a completed run

### `streaming.test.ts`

- `POST .../stream` sequential-steps — SSE chunks for each step + final result
- `POST .../stream` basic-suspend then `/resume-stream` — streamed suspend/resume lifecycle

## API URL Reference

All endpoints are prefixed with `/api`. Full patterns used in tests:

```
# Discovery
GET  /api/workflows
GET  /api/workflows/:workflowId

# Execution
POST /api/workflows/:workflowId/start-async?runId=<uuid>
POST /api/workflows/:workflowId/stream?runId=<uuid>

# Control (all require ?runId=<uuid>)
POST /api/workflows/:workflowId/resume-async?runId=<uuid>
POST /api/workflows/:workflowId/resume-stream?runId=<uuid>
POST /api/workflows/:workflowId/restart-async?runId=<uuid>
POST /api/workflows/:workflowId/time-travel-async?runId=<uuid>

# Run management
GET    /api/workflows/:workflowId/runs
GET    /api/workflows/:workflowId/runs/:runId
DELETE /api/workflows/:workflowId/runs/:runId
POST   /api/workflows/:workflowId/runs/:runId/cancel
```

## Test Utilities

**`tests/utils.ts`:**

- `fetchApi(path, options?)` — wraps `fetch` with `baseUrl`, sets `Content-Type: application/json`, parses JSON response
- `streamApi(path, body?)` — wraps `fetch` for stream endpoints. The Mastra server responds with `Content-Type: text/plain` (not SSE), using newline-delimited JSON with `\x1E` (record separator) as the chunk delimiter. The helper reads the response body as text, splits on `\x1E`, and parses each chunk as JSON. Returns an async iterator yielding parsed event objects.

## Running the Tests

```bash
cd e2e-tests/smoke
pnpm install --ignore-workspace
pnpm test
```

The `pnpm install` step pulls the latest `alpha` packages. Vitest globalSetup handles `mastra build` + `mastra start` automatically.

## Future Phases

This infrastructure supports adding more test suites:

- `tests/agents/` — agent execution, tool calling, structured output
- `tests/scorers/` — evaluation scoring
- `tests/datasets/` — dataset management
- `tests/memory/` — conversation memory, threads
- `tests/mcp/` — MCP server integration

Each phase adds new definitions to `src/mastra/` and new test files to `tests/`.
