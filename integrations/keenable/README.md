# @mastra/keenable

[Keenable](https://keenable.ai) web search and page-fetch tools for [Mastra](https://mastra.ai) agents.

**Keyless by default.** The tools work with no account or API key against Keenable's public endpoints (rate-limited). An optional `KEENABLE_API_KEY` lifts the hourly cap; it is never a prerequisite.

## Installation

```bash
npm install @mastra/keenable zod
```

No provider SDK is required; the package talks to the Keenable HTTP API directly.

## Quick Start

Use `createKeenableTools()` to get both tools with a shared configuration:

```typescript
import { Agent } from '@mastra/core/agent';
import { createKeenableTools } from '@mastra/keenable';

const tools = createKeenableTools();
// Keyless by default. To lift the rate limit, set KEENABLE_API_KEY
// or pass an explicit key:
// const tools = createKeenableTools({ apiKey: 'keen_...' });

const agent = new Agent({
  id: 'web-research-agent',
  name: 'Web Research Agent',
  instructions: 'You research topics on the web: search for sources, then read the most relevant pages.',
  model: 'anthropic/claude-sonnet-4-6',
  tools,
});
```

By default the tools read `KEENABLE_API_KEY` from the environment when present; with no key they call the keyless public endpoints. Set `KEENABLE_API_URL` to point at a different base URL.

## Individual Tools

Each tool can be created independently:

```typescript
import { createKeenableSearchTool, createKeenableFetchTool } from '@mastra/keenable';

const searchTool = createKeenableSearchTool(); // keyless
const fetchTool = createKeenableFetchTool({ apiKey: 'keen_...' });
```

### Search

Queries the Keenable web index. Accepts:

- `query` (required)
- `site`: restrict to a single domain, e.g. `'techcrunch.com'`
- `publishedAfter` / `publishedBefore`: filter by publication date (YYYY-MM-DD)
- `acquiredAfter` / `acquiredBefore`: filter by index date (YYYY-MM-DD)
- `maxResults`: cap results (1-20)

Returns `{ query, results: [{ title, url, description?, publishedAt?, acquiredAt? }] }`.

### Fetch

Fetches a single URL and returns its main content as markdown:

- `url` (required)

Returns `{ url, title?, content?, description?, author?, publishedAt? }`.

## Configuration

`createKeenable*Tool` and `createKeenableTools` accept:

- `apiKey`: optional, falls back to `KEENABLE_API_KEY`. Keyless when unset.
- `baseUrl`: optional, falls back to `KEENABLE_API_URL`, then `https://api.keenable.ai`.
- `clientSource`: attribution tag Keenable segments integration traffic by (defaults to `'Mastra'`).

Get a key at [keenable.ai/console](https://keenable.ai/console).

## License

Apache-2.0
