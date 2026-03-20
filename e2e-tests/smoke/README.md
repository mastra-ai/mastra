# Smoke Tests

Post-release smoke tests that run locally against `alpha`-tagged Mastra packages. Tests exercise Mastra features end-to-end through the HTTP API server, using `mastra build` + `mastra start` for the full production server path.

## Running

```bash
cd e2e-tests/smoke
pnpm install --ignore-workspace
pnpm test
```

`pnpm install` pulls the latest `alpha` packages. Vitest's globalSetup handles `mastra build`, starts the server on a random port, runs all tests, then tears down.

## What's tested

### Workflows (Phase 1)

| Test File | Features |
|-----------|----------|
| `basic.test.ts` | Sequential steps, input/output schema validation, `.map()` between steps |
| `control-flow.test.ts` | `.branch()`, `.parallel()`, `.dowhile()`, `.dountil()`, `.foreach()` |
| `suspend-resume.test.ts` | Suspend with payload, resume with data, parallel branch suspend, loop suspend |
| `state.test.ts` | Workflow-level `setState()`, `initialState` |
| `nested.test.ts` | Workflow as a step inside another workflow |
| `error-handling.test.ts` | Step retries, step failure |
| `run-management.test.ts` | List/get/delete runs, cancel (via sleep), time-travel |
| `streaming.test.ts` | Stream execution, stream suspend/resume |

## Project structure

```
e2e-tests/smoke/
├── src/mastra/
│   ├── index.ts              # Mastra instance with all workflows + LibSQL storage
│   └── workflows/
│       ├── basic.ts
│       ├── control-flow.ts
│       ├── suspend-resume.ts
│       ├── state.ts
│       ├── nested.ts
│       └── error-handling.ts
└── tests/
    ├── setup.ts              # globalSetup: build, start server, teardown
    ├── utils.ts              # fetchApi(), startWorkflow(), streamWorkflow(), etc.
    └── workflows/
        └── *.test.ts
```

## Adding new tests

1. Define workflows in `src/mastra/workflows/`
2. Register them in `src/mastra/index.ts`
3. Write tests in `tests/` using helpers from `tests/utils.ts`
4. Tests hit the API via raw `fetch` — no SDK dependency

## Future phases

This infrastructure supports additional test suites for agents, scorers, datasets, memory, and MCP.
