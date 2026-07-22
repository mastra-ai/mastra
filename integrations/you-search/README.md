# @mastra/you-search

[You.com](https://you.com) web search tool for [Mastra](https://mastra.ai) agents.

Works with **zero configuration**: without an API key, searches use You.com's keyless free tier (rate limited per IP), so `npm install` + import yields working results immediately. Set the `YDC_API_KEY` environment variable (or pass `{ apiKey }`) to use the keyed [You.com Search API](https://you.com/docs/api-reference/search/v1-search) with higher limits.

## Installation

```bash
npm install @mastra/you-search zod
```

## Quick Start

```typescript
import { Agent } from '@mastra/core/agent';
import { createYouTools } from '@mastra/you-search';

const agent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  instructions: 'You are a research assistant with access to web search.',
  model: 'anthropic/claude-sonnet-4-6',
  tools: createYouTools(),
});
```

Or create the search tool individually:

```typescript
import { createYouSearchTool } from '@mastra/you-search';

const searchTool = createYouSearchTool();

// With an API key for higher limits:
const keyedSearchTool = createYouSearchTool({ apiKey: process.env.YDC_API_KEY });
```

## Tools

### `you-search`

Searches the web via the You.com Search API and returns LLM-ready web and news results with titles, URLs, descriptions, and text snippets.

Input parameters:

| Parameter | Type | Description |
| --- | --- | --- |
| `query` | `string` | The search query (required). |
| `count` | `number` | Max results per section (web, news), 1–100. Default 10. |
| `freshness` | `string` | `day`, `week`, `month`, `year`, or `YYYY-MM-DDtoYYYY-MM-DD`. |
| `country` | `string` | Two-letter country code for geographic focus (e.g. `US`). |
| `language` | `string` | Result language, BCP 47 (e.g. `EN`, `PT-BR`). |
| `safesearch` | `'off' \| 'moderate' \| 'strict'` | Content moderation level. |
| `includeDomains` | `string[]` | Strict domain allowlist. Cannot combine with `excludeDomains`. |
| `excludeDomains` | `string[]` | Domain denylist. Cannot combine with `includeDomains`. |

## Configuration

All factory functions accept a `YouClientOptions` object:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | `process.env.YDC_API_KEY` | You.com API key. When absent, the keyless free tier is used. |
| `baseUrl` | `string` | keyed: `https://ydc-index.io`, keyless: `https://api.you.com` | Override the API base URL. |
| `fetch` | `typeof fetch` | global `fetch` | Custom fetch implementation for tests, retries, or instrumentation. |

## Free tier and rate limits

Without an API key, requests go to You.com's keyless endpoint, which is rate limited per IP (currently 100 searches/day) and does not support livecrawl. When the limit is reached, the tool throws an error explaining how to upgrade. Get a free API key with higher limits at [you.com/platform](https://you.com/platform).

## License

Apache-2.0
