# @mastra/mrscraper

Mastra [`createTool`](https://mastra.ai/docs) factories for [MrScraper](https://mrscraper.com): fetch HTML, AI and manual scrapers, results listing, and Google SERP sync. HTTP behavior matches the default tool surface of the open-source [**MrScraper MCP**](https://github.com/mrscraper/mrscraper-mcp) server (`stdio` or HTTP `/mcp`).

If you need the full MCP protocol (including ChatGPT job tools on `/chatgpt`), run that server next to your app and wire it with [`MCPClient`](https://mastra.ai/docs/mcp/overview) from `@mastra/mcp`.

## Installation

```sh
pnpm add @mastra/mrscraper zod
```

## Environment variables

| Variable | Used by |
| --- | --- |
| `MRSCRAPER_API_TOKEN` or `MRSCRAPER_TOKEN` | App APIs (fetch HTML, scrapers, results) |
| `MRSCRAPER_SYNC_ACCESS_TOKEN` (or `MRSCRAPER_SERP_ACCESS_TOKEN`) | `createMrscraperGoogleSerpSyncTool` |

You can pass `{ token }` and `{ syncAccessToken }` in code instead of env vars.

## Quick start

```typescript
import { createMrscraperTools } from '@mastra/mrscraper';

const tools = createMrscraperTools();
// Or: createMrscraperTools({ token: '...', syncAccessToken: 'atk_...' })

const agent = new Agent({
  // ...
  tools: {
    ...tools,
  },
});
```

## Tools

`createMrscraperTools()` returns:

- **mrscraperFetchHtml** — Unblocker HTML fetch (`https://api.mrscraper.com` query API).
- **mrscraperGoogleSerpSync** — Sync Google SERP (`sync.scraper.mrscraper.com`).
- **mrscraperCreateAiScraper**, **mrscraperRerunAiScraper**, **mrscraperBulkRerunAiScraper** — AI scraper APIs on `api.app.mrscraper.com`.
- **mrscraperRerunManualScraper**, **mrscraperBulkRerunManualScraper** — Manual scraper reruns.
- **mrscraperGetAllResults**, **mrscraperGetResultById** — Results APIs.

Each tool returns `{ status_code?, data?, headers?, error? }` like the MCP server.

## MCP server source

The reference MCP implementation lives alongside this monorepo at `../mrscraper-mcp` (FastMCP / Python). This package calls the same public HTTP endpoints so agents do not need a local MCP process unless you want MCP-specific features.
