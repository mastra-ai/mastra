# Slack Agent

A Mastra template for building Slack bots powered by AI agents with streaming responses and thread-based conversation memory. Each agent gets its own Slack app and webhook route. Built with [Mastra](https://mastra.ai).

## Why we built this

Connecting AI agents to Slack is one of the most common integration patterns — whether for internal tools, customer support, or team automation. This template shows how to wire up Mastra agents to Slack with proper streaming, thread memory, and multi-agent support. It includes two demo agents (reverse, caps) to demonstrate the pattern, so you can swap in your own agents and be up and running quickly.

## Demo

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys): Used by default, but you can swap in any model
- [Slack app](https://api.slack.com/apps) with bot token and signing secret (one per agent)
- [ngrok](https://ngrok.com) or similar tunnel for local development

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template slack-agent` to scaffold the project locally.
2. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your OpenAI API key and Slack credentials.
3. **Create Slack apps**
   - For each agent, create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**.
   - **OAuth & Permissions** → add scopes: `app_mentions:read`, `channels:history`, `chat:write`, `im:history`. Copy the Bot User OAuth Token to `.env`.
   - **Event Subscriptions** → enable and set the Request URL to `https://your-server.com/slack/{agentName}/events`.
   - Subscribe to bot events: `app_mention`, `message.im`.
   - **Agents & AI Apps** → toggle on.
   - **Basic Information** → copy Signing Secret to `.env`.
4. **Start the dev server**
   - Run `ngrok http 4111` to get a public URL, then `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Making it yours

This template is a starting point. Here are some ideas to make it your own:

- **Swap in your own agents** — replace the demo agents with agents that do something useful for your team. Add a Slack app config in `src/mastra/slack/routes.ts` and the corresponding env vars.
- **Add tools and workflows** — give agents access to APIs, databases, or multi-step workflows that execute when triggered from Slack.
- **Customize streaming behavior** — adjust the spinner animations, status messages, and typing indicators in `src/mastra/slack/streaming.ts`.
- **Deploy to production** — remove ngrok and deploy behind a public URL with proper TLS.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
