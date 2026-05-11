# @mastra/brightdata

[Bright Data](https://brightdata.com) web search and web fetch tools for [Mastra](https://mastra.ai) agents.

Backed by the official [`@brightdata/sdk`](https://github.com/brightdata/sdk-js). Bright Data's SERP API and Web Unlocker bypass bot detection and CAPTCHAs, so the tools work on sites that block typical scrapers.

## Installation

```bash
npm install @mastra/brightdata zod
```

## Quick Start

Use `createBrightDataTools()` to get both tools with a shared configuration:

```typescript
import { Agent } from '@mastra/core/agent';
import { createBrightDataTools } from '@mastra/brightdata';

const tools = createBrightDataTools();
// Or pass an explicit API token:
// const tools = createBrightDataTools({ apiKey: 'brd_...' });

const agent = new Agent({
  id: 'realtime-information-agent',
  name: 'Realtime Information Agent',
  instructions:
    'You are a realtime information agent. Use brightdata-search to find pages, and brightdata-fetch to read them.',
  model: 'anthropic/claude-sonnet-4-6',
  tools,
});
```

By default the tools read `BRIGHTDATA_API_TOKEN` from your environment. You can also pass `{ apiKey }` explicitly.

## Individual Tools

Each tool can be created independently:

```typescript
import { createBrightDataSearchTool, createBrightDataFetchTool } from '@mastra/brightdata';

const search = createBrightDataSearchTool({ apiKey: 'brd_...' });
const fetch = createBrightDataFetchTool(); // uses BRIGHTDATA_API_TOKEN env var
```

### Web Search (`brightdata-search`)

```typescript
import { createBrightDataSearchTool } from '@mastra/brightdata';

const searchTool = createBrightDataSearchTool();

// When called by an agent, accepts:
// - query (required)
// - country: 2-letter code (e.g., 'us', 'gb')
// - start: result offset for pagination (e.g. 10 for the second page of 10 results)
//
// Returns:
// {
//   query: string,
//   results: Array<{ link, title, description }>,
//   currentPage: number
// }
```

### Web Fetch (`brightdata-fetch`)

```typescript
import { createBrightDataFetchTool } from '@mastra/brightdata';

const fetchTool = createBrightDataFetchTool();

// Accepts: url (required)
// Returns: { url, content }  // content is Markdown
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `process.env.BRIGHTDATA_API_TOKEN` | Your Bright Data API token |

All tools accept the full `BrightDataClientOptions` from `@brightdata/sdk` (including `timeout`, `webUnlockerZone`, `serpZone`, `rateLimit`, etc.). If no API token is found, the tool throws a clear error at execution time.

## RAG Pairing Example

Combine search and fetch for retrieval-augmented generation:

```typescript
import { Agent } from '@mastra/core/agent';
import { createBrightDataTools } from '@mastra/brightdata';

const agent = new Agent({
  id: 'rag-agent',
  name: 'Research Assistant',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: `You are a research assistant. Use brightdata-search to find relevant pages, then use brightdata-fetch to get full Markdown content from the best results.`,
  tools: createBrightDataTools(),
});
```

## License

Apache-2.0
