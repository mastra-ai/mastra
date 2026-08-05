# Claw — Autonomous Personal Assistant

An autonomous assistant that operates a computer to finish multi-step tasks — read/write files, run shell commands in a sandboxed workspace, browse the web with Playwright (`@mastra/agent-browser`), search the web through Mastra's Gateway, and follow reusable skills checked into `workspace/skills/`.

Claw has resource-scoped observational memory, so it remembers your preferences and context across threads.

## Prerequisites

- Node.js `>= 22.13.0`
- A Gateway API key — get one at [gateway.mastra.ai](https://gateway.mastra.ai)
- (Optional) A Turso database; for local dev, the default `file:./mastra.db` works.
- Playwright's Chromium browser for local runs, or `BROWSER_CDP_URL` for a hosted Chrome/Browserbase/Browserless instance in server deployments.

## Setup

```bash
npm install
cp .env.example .env
# fill in MASTRA_GATEWAY_API_KEY (TURSO_DATABASE_URL defaults to file:./mastra.db)
npm run dev
```

Then open Mastra Studio (URL printed by `npm run dev`) and chat with the `claw` agent.

## Workspace layout

```text
workspace/
├── skills/
│   ├── general-tasks/SKILL.md
│   └── research-tasks/SKILL.md
└── … your files end up here
```

The agent can only read/write inside `workspace/` (or whatever `CLAW_WORKSPACE_DIR` points at). The sandboxed shell runs with that directory as its CWD.

## Adding skills

Create a new folder under `workspace/skills/<skill-name>/` with a `SKILL.md`:

```markdown
---
name: my-skill
description: Short summary the agent uses to decide when to apply this skill.
version: 1
metadata:
  tags: [optional, tags]
---

# Process

1. Step one.
2. Step two.
```

The agent will pick up new skills on the next request.

## Environment variables

| Variable                 | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `MASTRA_GATEWAY_API_KEY` | Routes the chat model and web search through the Gateway.             |
| `TURSO_DATABASE_URL`     | libSQL/Turso URL. Defaults to `file:./mastra.db`.                     |
| `TURSO_AUTH_TOKEN`       | Turso auth token (omit for local file DB).                            |
| `CLAW_WORKSPACE_DIR`     | Override the workspace root directory.                                |
| `BROWSER_HEADLESS`       | Set to `false` to launch the browser headfully. Defaults to headless. |
| `BROWSER_CDP_URL`        | Optional hosted browser CDP URL for server deployments.               |

## Agent Editor

This template enables the code-backed Agent Editor with `new MastraEditor({ source: 'code', codePath: 'mastra/editor' })`. Edits made in Studio are written as deterministic JSON overrides under `mastra/editor/agents/`, so Mastra Platform can open GitHub pull requests for agent changes instead of only saving them to the database.
