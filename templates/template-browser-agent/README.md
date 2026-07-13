# Browser Agent

A browser-using agent built on [`@mastra/agent-browser`](https://mastra.ai/docs/browser/agent-browser). It wraps Playwright with a snapshot+refs pattern — the model sees a stable ID for each element instead of brittle CSS selectors — and auto-wires browser tools (`browser_goto`, `browser_click`, `browser_type`, `browser_snapshot`, etc.) onto the agent. Also has `web_search` for tasks that don't need a live page.

If you'd rather use [Stagehand / Browserbase](https://www.browserbase.com/) (AI-driven element detection, cloud-hosted browsers), see [`template-browsing-agent`](../template-browsing-agent/) instead.

## Demo

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- A [Gateway API key](https://mastra.ai/docs/models/gateways/mastra).
- A [Turso](https://turso.tech) database URL + auth token (or swap to `:memory:` for ephemeral local runs).
- Playwright Chromium is installed by the `playwright-chromium` package during dependency install. On Linux root runtimes, the template runs `playwright install-deps chromium` before the first local browser launch. You can set `BROWSER_CDP_URL` for a hosted Chrome/Browserbase/Browserless instance instead.

## Quickstart 🚀

1. **Add your API keys**
   - Copy `.env.example` to `.env` and fill it in. Set `BROWSER_HEADLESS=false` if you want to watch the agent click around locally.
   - For server deployments, leave `BROWSER_SKIP_INSTALL_DEPS=false` so Linux Chromium system dependencies are installed before first browser use, or set `BROWSER_CDP_URL` to a hosted browser endpoint.
2. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111).

Ask things like:

- "Open https://news.ycombinator.com and tell me the top three stories right now."
- "Search Wikipedia for the GDP of France in 2024 and report the figure with a source."
- "Go to https://www.npmjs.com/package/zod and list the dependencies in the latest version."

## How it works

```ts
const browser = new AgentBrowser({
  headless: true,
  ...(process.env.BROWSER_CDP_URL ? { cdpUrl: process.env.BROWSER_CDP_URL, scope: 'shared' } : {}),
});

export const browserAgent = new Agent({
  // …
  browser,
  tools: { web_search: openai.tools.webSearch({}) },
});
```

Passing `browser` to the agent automatically registers the full browser toolset (`browser_goto`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_scroll`, `browser_screenshot`, etc.) on the agent. The template installs Playwright's Linux system dependencies before first local browser launch when running as root; set `BROWSER_CDP_URL` to connect to a remote browser instead.

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
