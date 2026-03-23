# Smoke Tests

Post-release smoke tests that run against `alpha`-tagged Mastra packages. Tests exercise Mastra features end-to-end through the HTTP API and Studio UI.

## Setup

```bash
cd e2e-tests/smoke
cp .env.example .env   # fill in OPENAI_API_KEY (required), Slack vars (optional)
pnpm install --ignore-workspace
```

## Running

You must build before running any tests:

```bash
pnpm build              # API tests only
pnpm build:studio       # API + UI tests (includes Studio assets)
```

### API tests (Vitest)

```bash
pnpm build
pnpm test
```

### UI tests (Playwright)

```bash
pnpm build:studio
pnpm test:ui
```

### Both

```bash
pnpm build:studio
pnpm test:all
```

### Slack report (after tests)

```bash
CI=1 pnpm build:studio && pnpm test:all   # generates reports/ + videos
pnpm report:slack                           # posts combined results to Slack DM
```

The report includes both API (Vitest) and UI (Playwright) results. The script loads `.env` automatically for local runs.

## CI / GitHub Actions

The workflow at `.github/workflows/smoke.yml` runs twice daily (1 hour after alpha publish at 05:00/17:00 UTC), or on manual dispatch:

1. Checks for new alpha versions via `pnpm update --ignore-workspace`
2. If the lockfile changed (or `force` flag is set), builds the project (`mastra build --studio`)
3. Runs API tests (Vitest) and UI tests (Playwright)
4. Posts combined results to Slack (pass or fail, with failure videos and a link to the workflow run)
5. Uploads test artifacts
6. Commits the updated lockfile back to the branch

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

See [`tests/COVERAGE.md`](tests/COVERAGE.md) for the full test inventory. Coverage includes Workflows, Agents, Tools, Memory, MCP, Datasets, Scores, Processors, Workspaces, and Observability.

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
│   ├── setup.ts              # globalSetup: start server, teardown
│   ├── utils.ts              # fetchApi(), startWorkflow(), etc.
│   ├── COVERAGE.md           # Test inventory
│   └── agents/workflows/...  # Test files by feature
├── tests-ui/                 # UI tests (Playwright)
│   ├── global-setup.ts       # Clean state before run
│   ├── helpers.ts            # Shared Playwright helpers
│   ├── COVERAGE.md           # Test inventory
│   └── agents/workflows/...  # Test spec files
├── reports/                  # JSON test results (gitignored)
└── scripts/
    └── slack-report.ts       # Slack DM reporter (API + UI)
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
