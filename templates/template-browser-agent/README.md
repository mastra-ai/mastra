# Browser Agent

A browser-using agent built on [`@mastra/agent-browser`](https://mastra.ai/docs/browser/agent-browser). It wraps Playwright with a snapshot+refs pattern — the model sees a stable ID for each element instead of brittle CSS selectors — and auto-wires browser tools (`browser_goto`, `browser_click`, `browser_type`, `browser_snapshot`, etc.) onto the agent. Also has `web_search` for tasks that don't need a live page.

If you'd rather use [Stagehand / Browserbase](https://www.browserbase.com/) (AI-driven element detection, cloud-hosted browsers), see [`template-browsing-agent`](../template-browsing-agent/) instead.

## Demo

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- A [Mastra Gateway API key](https://mastra.ai/docs/models/gateways/mastra).
- A [Turso](https://turso.tech) database URL + auth token (or swap to `:memory:` for ephemeral local runs).
- For server deployments, a hosted Chrome/Browserbase/Browserless endpoint via `BROWSER_CDP_URL`. Local Chromium is opt-in because many server images do not include Chrome system libraries.

## Quickstart 🚀

1. **Add your API keys**
   - Copy `.env.example` to `.env` and fill it in. Set `BROWSER_HEADLESS=false` if you want to watch the agent click around locally.
   - For server deployments, set `BROWSER_CDP_URL` to a hosted browser endpoint. Without it, the agent still starts and can use web search, but browser automation tools stay disabled.
   - For local-only runs, set `BROWSER_ALLOW_LOCAL_CHROMIUM=true` to launch the installed local Chromium.
2. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111).

Ask things like:

- "Open https://news.ycombinator.com and tell me the top three stories right now."
- "Search Wikipedia for the GDP of France in 2024 and report the figure with a source."
- "Go to https://www.npmjs.com/package/zod and list the dependencies in the latest version."

## How it works

```ts
const browser = process.env.BROWSER_CDP_URL
  ? new AgentBrowser({ headless: true, cdpUrl: process.env.BROWSER_CDP_URL, scope: 'shared' })
  : process.env.BROWSER_ALLOW_LOCAL_CHROMIUM === 'true'
    ? new AgentBrowser({ headless: true })
    : undefined;

export const browserAgent = new Agent({
  // …
  browser,
  tools: { web_search: openai.tools.webSearch({}) },
});
```

Passing `browser` to the agent automatically registers the full browser toolset (`browser_goto`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_scroll`, `browser_screenshot`, etc.) on the agent. The template only creates the browser when `BROWSER_CDP_URL` is set or `BROWSER_ALLOW_LOCAL_CHROMIUM=true`, so server deployments do not fail on missing Chromium system libraries.

## Making it yours

- **Add a session profile.** `AgentBrowser({ profile: '/path/to/profile' })` persists cookies, logins, and localStorage between runs.
- **Use a remote browser.** Set `BROWSER_CDP_URL` to attach to a Browserbase, Browserless, or hosted Chrome instance instead of launching locally.
- **Drop tools you don't want.** `AgentBrowser({ excludeTools: ['browser_screenshot'] })` is useful when targeting a text-only model.
- **Swap the model.** Any `mastra/<provider>/<model>` id works. The browser tools are provider-agnostic.

## Agent Editor

This template enables the code-backed Agent Editor with `new MastraEditor({ source: 'code', codePath: 'mastra/editor' })`. Edits made in Studio are written as deterministic JSON overrides under `mastra/editor/agents/`, so Mastra Platform can open GitHub pull requests for agent changes instead of only saving them to the database.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show what you can build. Use the platform-created repository as your starting point, then customize it for your app.

Want to contribute? See the [Mastra contributing guide](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md).
