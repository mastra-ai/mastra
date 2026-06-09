# Browser Agent

A browser-using agent built on [`@mastra/agent-browser`](https://mastra.ai/docs/browser/agent-browser). It wraps Playwright with a snapshot+refs pattern — the model sees a stable ID for each element instead of brittle CSS selectors — and auto-wires browser tools (`browser_goto`, `browser_click`, `browser_type`, `browser_snapshot`, etc.) onto the agent. Also has `web_search` for tasks that don't need a live page.

If you'd rather use [Stagehand / Browserbase](https://www.browserbase.com/) (AI-driven element detection, cloud-hosted browsers), see [`template-browsing-agent`](../template-browsing-agent/) instead.

## Demo

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- A [Mastra Gateway API key](https://mastra.ai/docs/models/gateways/mastra).
- A [Turso](https://turso.tech) database URL + auth token (or swap to `:memory:` for ephemeral local runs).
- Playwright's Chromium browser. The template installs it on first startup if the local Playwright browser cache is empty.

## Quickstart 🚀

1. **Add your API keys**
   - Copy `.env.example` to `.env` and fill it in. Set `BROWSER_HEADLESS=false` if you want to watch the agent click around.
2. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111).

Ask things like:

- "Open https://news.ycombinator.com and tell me the top three stories right now."
- "Search Wikipedia for the GDP of France in 2024 and report the figure with a source."
- "Go to https://www.npmjs.com/package/zod and list the dependencies in the latest version."

## How it works

```ts
const browser = new AgentBrowser({ headless: true });

export const browserAgent = new Agent({
  // …
  browser,
  tools: { web_search: openai.tools.webSearch({}) },
});
```

Passing `browser` to the agent automatically registers the full browser toolset (`browser_goto`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_scroll`, `browser_screenshot`, etc.) on the agent. You don't have to wire individual tools yourself.

## Making it yours

- **Add a session profile.** `AgentBrowser({ profile: '/path/to/profile' })` persists cookies, logins, and localStorage between runs.
- **Use a remote browser.** Pass `cdpUrl` to attach to a Browserbase or hosted Chrome instance instead of launching locally.
- **Drop tools you don't want.** `AgentBrowser({ excludeTools: ['browser_screenshot'] })` is useful when targeting a text-only model.
- **Swap the model.** Any `mastra/<provider>/<model>` id works. The browser tools are provider-agnostic.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show what you can build. Use the platform-created repository as your starting point, then customize it for your app.

Want to contribute? See the [Mastra contributing guide](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md).
