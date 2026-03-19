# Browser Agent Example

A Mastra agent with browser capability — it can navigate websites, interact with elements, and extract information.

## Setup

```bash
pnpm i --ignore-workspace
```

Requires `OPENAI_API_KEY` in your environment.

## Run

```bash
pnpm start
```

Or with a custom query:

```bash
npx tsx src/index.ts "Go to https://example.com and describe the page"
```

## How it works

The agent uses `@mastra/browser-agent-browser` which wraps [agent-browser](https://github.com/vercel-labs/agent-browser) (Vercel's headless browser library). The browser tools are automatically merged into the agent's tool set via the `browser` property on the agent config.

Available browser tools:
- `browser_navigate` — go to a URL
- `browser_snapshot` — capture accessibility tree with element refs
- `browser_click` — click elements by ref
- `browser_type` — type into input fields
- `browser_select` — select dropdown options
- `browser_scroll` — scroll the page
- `browser_screenshot` — capture screenshots
- `browser_close` — close the browser session
