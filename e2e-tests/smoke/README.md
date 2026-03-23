# Smoke Tests

Post-release smoke tests that run against `alpha`-tagged Mastra packages. Tests exercise Mastra features end-to-end through the HTTP API and Studio UI.

## Setup

```bash
cd e2e-tests/smoke
cp .env.example .env   # fill in OPENAI_API_KEY (required), Slack vars (optional)
pnpm install --ignore-workspace
```

## Running

### API tests (Vitest)

```bash
pnpm test
```

Vitest's globalSetup handles `mastra build`, starts the server, runs tests, then tears down.

### UI tests (Playwright)

```bash
pnpm test:ui
```

Playwright's globalSetup builds the project and starts the dev server automatically.

### Slack report (after UI tests)

```bash
CI=1 pnpm test:ui        # generates test-results/report.json + videos
pnpm report:slack         # posts results to Slack DM
```

The script loads `.env` automatically for local runs.

## CI / GitHub Actions

The workflow at `.github/workflows/smoke.yml` runs on a weekday cron:

1. Checks for new alpha versions via `pnpm update --ignore-workspace`
2. If the lockfile changed, runs the full UI test suite
3. Posts results to Slack (pass or fail, with failure videos)
4. Commits the updated lockfile back to the branch

### Required repository secrets

| Secret | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (`sk-...`) |
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token (`xoxb-...`) |
| `SLACK_USER_ID` | Your Slack member ID (`U...`) |

### Slack app setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Under **OAuth & Permissions**, add these **Bot Token Scopes**:
   - `chat:write` — post messages
   - `files:write` — upload failure videos
   - `files:read` — read uploaded files
   - `im:write` — open DM conversations
3. **Install to Workspace** and copy the **Bot User OAuth Token** (`xoxb-...`)
4. Find your Slack user ID: click your profile → **⋮** → **Copy member ID**

## What's tested

### API tests (Vitest)

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

### UI tests (Playwright)

See [`tests-ui/COVERAGE.md`](tests-ui/COVERAGE.md) for the full test inventory.

## Project structure

```
e2e-tests/smoke/
├── .env.example              # Required env vars
├── src/mastra/
│   ├── index.ts              # Mastra instance with agents, workflows, storage
│   ├── agents/               # Agent fixtures
│   └── workflows/            # Workflow fixtures
├── tests/                    # API tests (Vitest)
│   ├── setup.ts              # globalSetup: build, start server, teardown
│   ├── utils.ts              # fetchApi(), startWorkflow(), etc.
│   └── workflows/
├── tests-ui/                 # UI tests (Playwright)
│   ├── global-setup.ts       # Build + clean state
│   ├── helpers.ts            # Shared Playwright helpers
│   ├── COVERAGE.md           # Test inventory
│   └── agents/workflows/...  # Test spec files
└── scripts/
    └── slack-report.ts       # Slack DM reporter
```

## Adding new tests

### API tests

1. Define workflows in `src/mastra/workflows/`
2. Register them in `src/mastra/index.ts`
3. Write tests in `tests/` using helpers from `tests/utils.ts`
4. Tests hit the API via raw `fetch` — no SDK dependency

### UI tests

1. Define fixtures (agents, workflows) in `src/mastra/`
2. Register them in `src/mastra/index.ts`
3. Write Playwright specs in `tests-ui/`
4. Update `tests-ui/COVERAGE.md`
