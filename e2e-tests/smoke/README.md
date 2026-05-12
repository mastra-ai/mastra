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
pnpm report:slack                           # posts combined results to Slack
```

The report includes both API (Vitest) and UI (Playwright) results. The script loads `.env` automatically for local runs. Set `SLACK_CHANNEL_ID` to the channel you want results posted to (the bot must be a member).

## CI / GitHub Actions

The workflow at `.github/workflows/smoke.yml` runs on two triggers:

- **`workflow_run`** — fires automatically when the `Publish to npm` workflow completes on `main`. A `resolve` job inspects which publish job succeeded:
  - `prerelease` succeeded → smoke runs against `alpha`
  - `stable` succeeded → smoke runs against `latest`
  - `snapshot` only (or no main-line publish job) → smoke is skipped
- **`workflow_dispatch`** — manual run with a `tag` input (defaults to `alpha`). Use this to smoke `latest`, retry a failed `alpha`, or test a custom dist-tag.

Each run:

1. Rewrites Mastra deps in `package.json` to the resolved tag, then `pnpm install --no-frozen-lockfile --ignore-workspace`
2. Builds the project (`mastra build --studio`)
3. Runs API tests (Vitest) and UI tests (Playwright) on both Zod 3 and Zod 4
4. Posts combined results to a Slack channel (with failure videos and run links)
5. Uploads test artifacts

All GitHub-managed config is prefixed `SMOKE_*` so it groups together in repo **Settings → Secrets and variables → Actions**.

### Required repository secrets

| Secret | Description |
|---|---|
| `SMOKE_OPENAI_API_KEY` | OpenAI API key used by all smoke agents (`gpt-4o-mini`). |
| `SMOKE_SLACK_BOT_TOKEN` | Slack Bot User OAuth Token (`xoxb-...`) |

### Required repository variables

| Variable | Description |
|---|---|
| `SMOKE_SLACK_CHANNEL_ID` | Slack channel ID (`C...`) to post smoke results to. The bot must be invited to this channel. |

### Slack app setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Under **OAuth & Permissions**, add these **Bot Token Scopes**:
   - `chat:write` — post messages
   - `files:write` — upload failure videos
   - `files:read` — read uploaded files
3. **Install to Workspace** and copy the **Bot User OAuth Token** (`xoxb-...`)
4. **Invite the bot to the smoke channel** (`/invite @your-bot-name`). Without this, `chat.postMessage` returns `not_in_channel`.
5. Get the channel ID: in Slack, click the channel name → **About** → copy the **Channel ID** at the bottom.

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
    └── slack-report.ts       # Slack channel/DM reporter (API + UI)
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
