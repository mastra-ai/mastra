# @mastra/tavily

Tavily web search, extract, crawl, and map tools for [Mastra](https://mastra.ai) agents.

## Installation

```bash
npm install @mastra/tavily @tavily/core zod
```

## Quick Start

Use `createTavilyTools()` to get all four tools with a shared configuration:

```typescript
import { Agent } from '@mastra/core/agent';
import { createTavilyTools } from '@mastra/tavily';

const tools = createTavilyTools();
// Or pass an explicit API key:
// const tools = createTavilyTools({ apiKey: 'tvly-...' });

const agent = new Agent({
  id: 'realtime-information-agent',
  name: "Realtime Information Agent",
  instructions: "You are a realtime information agent that can search the web for the latest information and provide it to the user.",
  model: "anthropic/claude-sonnet-4-6",
  tools,
});
```

By default, the tools read `TAVILY_API_KEY` from your environment. You can also pass `{ apiKey }` explicitly.

## Individual Tools

Each tool can be created independently:

```typescript
import { createTavilySearchTool, createTavilyExtractTool } from '@mastra/tavily';

const searchTool = createTavilySearchTool({ apiKey: 'tvly-...' });
const extractTool = createTavilyExtractTool(); // uses TAVILY_API_KEY env var
```

### Search

```typescript
import { createTavilySearchTool } from '@mastra/tavily';

const searchTool = createTavilySearchTool();

// When called by an agent, accepts:
// - query (required)
// - searchDepth: 'basic' | 'advanced'
// - maxResults: 1-20
// - includeAnswer: boolean | 'basic' | 'advanced'
// - includeImages, includeImageDescriptions, includeRawContent
// - includeDomains, excludeDomains
// - timeRange: 'day' | 'week' | 'month' | 'year'
```

### Extract

```typescript
import { createTavilyExtractTool } from '@mastra/tavily';

const extractTool = createTavilyExtractTool();

// Accepts: urls (1-20), extractDepth, includeImages, format ('markdown' | 'text')
// Returns: results[] + failedResults[]
```

### Crawl

```typescript
import { createTavilyCrawlTool } from '@mastra/tavily';

const crawlTool = createTavilyCrawlTool();

// Accepts: url, maxDepth, maxBreadth, limit, instructions,
//          selectPaths, selectDomains, excludePaths, excludeDomains,
//          allowExternal, extractDepth, includeImages, format
// Returns: baseUrl + results[]
```

### Map

```typescript
import { createTavilyMapTool } from '@mastra/tavily';

const mapTool = createTavilyMapTool();

// Accepts: url, maxDepth, maxBreadth, limit, instructions,
//          selectPaths, selectDomains, excludePaths, excludeDomains, allowExternal
// Returns: baseUrl + discovered URL strings
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `process.env.TAVILY_API_KEY` | Your Tavily API key |

All tools accept `TavilyClientOptions` from `@tavily/core` (includes `apiKey`, `proxies`, `apiBaseURL`, `clientSource`, `projectId`). If no API key is found, the tool throws a clear error at execution time. `clientSource` defaults to `'mastra'`.

## RAG Pairing Example

Combine search and extract for retrieval-augmented generation:

```typescript
import { Agent } from '@mastra/core/agent';
import { createTavilySearchTool, createTavilyExtractTool } from '@mastra/tavily';

const agent = new Agent({
  id: 'rag-agent',
  name: "Research Assistant",
  model: "anthropic/claude-sonnet-4-6",
  instructions: `You are a research assistant. Use tavily-search to find relevant pages, then use tavily-extract to get full content from the best results.`,
  tools: {
    search: createTavilySearchTool(),
    extract: createTavilyExtractTool(),
  },
});
```

## License

Apache-2.0
