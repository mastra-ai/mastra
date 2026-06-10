# create-agentbuilder

Scaffold a new [Mastra](https://mastra.ai/) project with the [Agent Builder](https://mastra.ai/docs/agent-builder/overview) pre-configured in a single command.

## Quick start

```bash
npm create agentbuilder
```

Or with other package managers:

```bash
pnpm create agentbuilder
yarn create agentbuilder
bun create agentbuilder
```

The CLI will prompt you for a project name and optionally enable [Mastra Observability](https://mastra.ai/docs/observability/overview) (opens a browser-based auth flow to the Mastra Platform).

## What you get

A ready-to-run Mastra project with:

- **Agent Builder** enabled at `http://localhost:4111/agent-builder`
- **Builder Agent** — the chat-based editor that helps create and configure agents
- **Observational Memory** — agents remember conversation history
- **Mastra Observability** — traces and spans via Storage + Platform exporters
- **LibSQL storage** — local SQLite for agent state, memory, and workspace data

## Usage

```bash
cd my-agent-builder
npm run dev
```

Open [http://localhost:4111/agent-builder](http://localhost:4111/agent-builder) to start building agents.

## Prerequisites

- Node.js ≥ 22.13.0
- An `OPENAI_API_KEY` environment variable (the Builder agent runs on OpenAI)

## Licensing

The Agent Builder is a Mastra Enterprise (EE) feature, licensed under the [Mastra Enterprise License](https://github.com/mastra-ai/mastra/blob/main/ee/LICENSE). It works without a license key in local development (`mastra dev`). Deploying it to production requires a valid license key set via the `MASTRA_EE_LICENSE` environment variable.

## Options

| Flag                        | Description                              |
| --------------------------- | ---------------------------------------- |
| `-p, --project-name <name>` | Project name and directory               |
| `-k, --llm-api-key <key>`   | OpenAI API key                           |
| `-t, --timeout [ms]`        | Package install timeout (default: 60000) |
| `--observe`                 | Enable Mastra Observability              |
| `--no-observe`              | Skip Mastra Observability                |

## Learn more

- [Agent Builder docs](https://mastra.ai/docs/agent-builder/overview)
- [Mastra docs](https://mastra.ai/docs/)
- [Discord community](https://discord.gg/BTYqqHKUrf)
