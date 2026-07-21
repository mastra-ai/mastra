# Agent harness

Agent harness is a general-purpose [Mastra](https://mastra.ai) agent that can research current information, manage multi-step tasks, work with local files, run approved shell commands, and create recurring schedules.

## Features

- A project-level `workspace/` for files and command execution
- Approval gates for file changes, deletions, and shell commands
- Conversation memory, generated thread titles, and task tracking
- OpenAI web search and direct web page fetching
- Recurring schedules that persist across restarts
- Local libSQL storage and DuckDB observability, with optional Turso storage
- A bundled Mastra skill that helps coding agents use current Mastra APIs

## Demo

Open the `Agent` in Mastra Studio and try one of these prompts:

- `Get the weather forecast for Austin this weekend.`
- `Create a landing page for a Japanese sakura festival.`
- `Check the SPCX stock price now, then check it every minute.`

The agent asks for approval before it changes files or runs commands. When it creates a schedule, it returns an ID that you can use to pause the schedule.

## Prerequisites

- Node.js 22.13 or newer
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Quickstart

1. Create the project:

   ```bash
   npx create-mastra@latest --template agent-harness
   ```

2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.

3. Install dependencies and start Mastra:

   ```bash
   npm install
   npm run dev
   ```

4. Open [localhost:4111](http://localhost:4111), select **Agent**, and send a demo prompt.

## Workspace safety

The local filesystem tools stay inside the project-level `workspace/` directory. Shell commands start in that directory, but `LocalSandbox` does not provide operating-system isolation by default. Review command approvals carefully, and do not expose this template through an unauthenticated public server.

## Storage

The default `file:./mastra.db` database stores agent memory, tasks, and schedules locally. To use Turso, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env`.

Recurring schedules continue to use model tokens until you pause them. Ask the agent to pause a schedule with the ID returned by `start_schedule`.

## Making it yours

- Edit `src/mastra/agents/agent.ts` to change the model, instructions, memory, workspace, or approval policy.
- Edit `src/mastra/tools/` to customize web fetching and scheduling.
- Edit `src/mastra/index.ts` to change storage and observability.
- Add files or reusable skills under `workspace/` for the agent to use.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show what you can build with Mastra. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synced to standalone repositories.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
