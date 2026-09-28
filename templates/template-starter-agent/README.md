# Starter Agent

Welcome to your new [Mastra](https://mastra.ai) project! We're excited to see what you build.

This starter combines the general-purpose agent harness with [`@mastra/connect`](https://mastra.ai/docs/connections/overview): a durable assistant that can research current information, manage multi-step tasks, work with workspace files, run approved commands, create recurring schedules — and whose integration tools and chat channels come live from your Mastra platform project's connections.

## Features

- **The agent speaks first** — on first boot it seeds a "👋 Welcome" thread where the agent introduces its capabilities, lists the integrations it can currently reach, and explains how to edit its system prompt from Studio
- **Connect tools** — every integration attached to your Mastra platform project (Linear, Notion, …) shows up as agent tools via `tools()`; attach or detach connections on the platform and the agent picks them up without a restart
- **Connect channels** — chat with the agent from Slack, Telegram, or Discord via `channels()`; channel connections resolve live from the platform too
- **Durable agent** — the agentic loop runs inside a workflow with chunks flowing through PubSub and a Redis-backed event cache, so streams survive client disconnects and process restarts, and orphaned runs are re-driven on boot
- **Workspace** — files and command execution with approval gates; uses `PlatformSandbox` and `PlatformFilesystem` when platform workspace env is set, and falls back to the local sandbox/filesystem otherwise
- **Studio editing** — `@mastra/editor` with `source: 'code'`: agent overrides and workflow definitions persist as files under `./mastra/editor`, and the workflow builder lets you author and edit workflows from Studio
- **Activity digest workflow** — a code-defined workflow that discovers connected integrations, gathers recent activity with read-only tools, and composes a cross-tool digest
- **Postgres storage** — threads, messages, memory, and workflow snapshots live in Postgres
- Conversation memory, generated thread titles, task tracking, web search and page fetching, and recurring schedules

## Get started

1. Copy `.env.example` to `.env` and set:
   - `MASTRA_GATEWAY_API_KEY` — model access via the Mastra gateway
   - `DATABASE_URL` — a Postgres connection string (required)
   - `REDIS_URL` — a Redis connection string (required; powers durable resumable streams)
2. Optionally connect integrations: create a project at [cloud.mastra.ai](https://cloud.mastra.ai), attach integrations to it, generate an access token, and set `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID`.
3. Optionally use the platform workspace: set `MASTRA_ENVIRONMENT_ID` (sandbox) and `MASTRA_PLATFORM_BUCKET_NAME` (filesystem).
4. Run:

```shell
npm run dev
```

Open [http://localhost:4111](http://localhost:4111) in your browser to access [Mastra Studio](https://mastra.ai/docs/studio/overview).

Select **Agent** in Mastra Studio and try one of these prompts:

- `Get the weather forecast for Austin this weekend.`
- `Summarize my open Linear issues.` (with a Linear connection attached)
- `Create a landing page for a Japanese sakura festival.`

The agent asks for approval before it changes files or runs commands. When it creates a schedule, it returns an ID that you can use to pause the schedule.

## How Connect resolution works

`tools()` and `channels()` return live resolvers over your platform project's connections. On each agent call (and at a short TTL), the resolver fetches the project's active connections and exposes each one's actions as tools named `<integration>_<action>` (for example `linear_list_issues`). Channels mount their webhook/OAuth routes at boot and late-bind credentials, so connecting Slack or Telegram on the platform takes effect without redeploying.

Without `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` the harness still boots — the agent just runs with its built-in tools and no channels.

## Editing agents and workflows

The editor runs in `source: 'code'` mode: Studio edits to agents and workflows persist as deterministic JSON files under `./mastra/editor`, so they are reviewable and versionable in git. The workflow builder in Studio can author new workflows against your registered agents and tools; saved definitions land in the same directory. The `activity-digest` workflow is a code-defined example you can run from Studio's Workflows tab.

## Workspace safety

With the local primitives, filesystem tools stay inside the `workspace/` directory (created under `src/mastra/public/workspace/` during `mastra dev`), but `LocalSandbox` does not provide operating-system isolation. With the platform primitives, commands run in an environment-scoped sandbox and files live in a platform bucket. Either way, review command approvals carefully, and do not expose this template through an unauthenticated public server.

## Durable execution

The agent is wrapped with `createDurableAgent()`, so the loop runs inside a workflow, events flow through PubSub, and the Redis cache replays chunks a client missed while disconnected. `recovery.durableAgents: 'auto'` re-drives orphaned running runs on boot — recovery re-issues LLM calls and re-executes tool calls, so keep side-effecting tools idempotent. See the [durable agents guide](https://mastra.ai/docs/harness/durable-agents).
