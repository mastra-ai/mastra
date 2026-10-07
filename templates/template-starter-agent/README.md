# Starter Agent

Welcome to your new [Mastra](https://mastra.ai) project! We're excited to see what you build.

This starter provides you with a general-purpose Mastra agent that can research current information, manage multi-step tasks, work with files, run approved shell commands, create recurring schedules, and use the integrations you connect from your Mastra platform project as its tools and chat channels.

Ask the agent "Help me get set up". The setup skill checks your project's connections and walks you through the next step in the platform and Studio.

## Features

- The agent introduces itself in a "👋 Welcome" thread the first time you open Studio
- Every integration you connect on the Mastra platform (Linear, Notion, Slack, …) shows up as tools the agent can use
- Chat with the agent from Slack, Telegram, or Discord by connecting those channels on the platform
- A `workspace/` for files and command execution, with approval gates for changes, deletions, and shell commands
- Conversation memory, generated thread titles, task tracking, web search, and web page fetching
- Recurring schedules that persist across restarts
- Edit the agent's instructions and author new workflows from Mastra Studio; changes save as files under `./mastra/editor`

## Get started

1. Copy `.env.example` to `.env` and set:
   - `MASTRA_GATEWAY_API_KEY` — model access via the Mastra gateway
   - `DATABASE_URL` — a Postgres connection string
2. Optionally attach integrations to your Mastra platform project and set `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` to make them available to the agent.
3. Run:

```shell
npm run dev
```

Open [http://localhost:4111](http://localhost:4111) in your browser to access [Mastra Studio](https://mastra.ai/docs/studio/overview).

Select **Agent** in Mastra Studio and try one of these prompts:

- `Get the weather forecast for Austin this weekend.`
- `Summarize my open Linear issues.` (with a Linear connection attached)
- `Create a landing page for a Japanese sakura festival.`
- `Check the SPCX stock price now, then check it every minute.`

The agent asks for approval before it changes files or runs commands. When it creates a schedule, it returns an ID that you can use to pause it.

## Making it yours

- Edit the agent's instructions, model, or memory settings from Studio, or in `src/mastra/agents/agent.ts`
- Author new workflows from Studio, or add them under `src/mastra/workflows/`
- Add tools under `src/mastra/tools/`
- Register everything in `src/mastra/index.ts`

## Learn more

To learn more about Mastra, visit our [documentation](https://mastra.ai/docs/). If you're new to AI agents, check out our [course](https://mastra.ai/learn) and [YouTube videos](https://youtube.com/@mastra-ai). You can also join our [Discord](https://discord.gg/mastra-ai) community to get help and share your projects.

## Deploy to the Mastra platform

The [Mastra platform](https://projects.mastra.ai) provides two products for deploying and managing AI applications built with the Mastra framework. Learn more in the [Mastra platform documentation](https://mastra.ai/docs/mastra-platform/overview).
