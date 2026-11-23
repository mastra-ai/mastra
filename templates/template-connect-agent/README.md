# Connect Agent

An assistant whose tools come from your Mastra platform integration connections via [`@mastra/connect`](https://www.npmjs.com/package/@mastra/connect). Attach Linear, Notion, or other integrations to your platform project and they show up as live agent tools — no per-provider API clients, no OAuth plumbing, no restart when connections change. Channel connections (Slack, Discord, Telegram) mount as live messaging routes the same way, and a workflow rounds it out by building a cross-integration activity digest.

## Why we built this

Wiring an agent to external SaaS tools usually means one SDK, one credential, and one toolset per provider — and redeploying every time you add one. Mastra Connect collapses all of that: `tools()` returns a single live tool resolver over whatever integrations your platform project has connected, refreshing as connections are attached or detached, and `channels()` does the same for messaging channels. This template demonstrates:

- **Dynamic agent tools** — the agent's `tools` option is a function, so the toolset is resolved per request from the platform.
- **Live messaging channels** — `channels: await channels()` on the `Mastra` instance mounts the Slack/Discord/Telegram webhook and OAuth routes up front; connecting a channel on the platform brings it live without a redeploy.
- **Calling the resolver directly** — the workflow's first step calls `tools()`'s resolver outside any agent to discover which integrations are connected.
- **Workflows + structured output** — the digest workflow chains tool-driven research into a typed, structured report.

## Demo

This demo runs in Mastra Studio, but you can connect this workflow to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- [Mastra Gateway API key](https://mastra.ai/docs/models/gateways/mastra): Used by default, but you can swap in any model
- A Postgres connection string (`DATABASE_URL`) for agent memory, threads, tasks, and workflow snapshots
- A Mastra platform project with at least one integration connected (Linear, Notion, …) and a platform access token

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template template-connect-agent` to scaffold the project locally.
2. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your keys.
3. **Connect integrations**
   - In your Mastra platform project, attach the integrations you want the agent to use. Channel integrations (Slack, Discord, Telegram) you connect become live messaging routes on the same server.
   - **Deployed?** Channel providers register Slack OAuth callbacks and Telegram webhooks against `MASTRA_SERVER_URL` — the server's public HTTPS URL. Mastra Cloud injects it automatically on every deploy; on other hosts, set it yourself (the container's bind address won't work).
4. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

Ask the agent things like "list my open Linear issues", "search Notion for the launch plan", or "turn the action items in that doc into Linear issues". Run the `activity-digest` workflow (optionally with a `focus`) to get a structured cross-tool summary of the last week.

## Making it yours

- **Scope the toolset** — pass per-integration options to `tools()` in `src/mastra/agents/connect-agent.ts`, e.g. `integrations: { linear: { allowTools: ['linear_list_issues', 'linear_create_issue'] } }` to restrict the Linear tools available to the agent. `allowTools` only filters that integration's tools; use `disabled: true` to exclude another connected integration entirely.
- **Pin connections** — set `connectionId` per integration if the project has more than one connection to the same provider. The same override shape works on `channels()` in `src/mastra/index.ts`.
- **Scope the channels** — pass `integrations: { discord: { disabled: true } }` to `channels()` to opt a channel out, or `providerOptions` to tune a specific provider.
- **Tune the digest** — edit the prompt and schema in `src/mastra/workflows/activity-digest.ts`, or schedule the workflow to post digests wherever you like.
- **Swap the model** — change the `model` string in `src/mastra/agents/connect-agent.ts` to any Gateway-supported model.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
