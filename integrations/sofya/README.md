# @mastra/sofya

Sofya web search, fetch, extract, and research tools for [Mastra](https://mastra.ai) agents.

## Installation

```bash
npm install @mastra/sofya zod
```

## Quick Start

Use `createSofyaTools()` to get all four tools with a shared configuration:

```typescript
import { Agent } from '@mastra/core/agent';
import { createSofyaTools } from '@mastra/sofya';

const tools = createSofyaTools();
// Or pass an explicit API key:
// const tools = createSofyaTools({ apiKey: 'ay_live_...' });

const agent = new Agent({
  id: 'realtime-information-agent',
  name: 'Realtime Information Agent',
  instructions: 'You are a realtime information agent that can search the web and research topics for the user.',
  model: 'anthropic/claude-sonnet-4-6',
  tools,
});
```

By default, the tools read `SOFYA_API_KEY` from your environment. You can also pass `{ apiKey }` explicitly. Get a key at [sofya.co](https://sofya.co).

## Individual Tools

Each tool can be created independently:

```typescript
import { createSofyaSearchTool, createSofyaResearchTool } from '@mastra/sofya';

const searchTool = createSofyaSearchTool({ apiKey: 'ay_live_...' });
const researchTool = createSofyaResearchTool(); // uses SOFYA_API_KEY env var
```

### Search

```typescript
import { createSofyaSearchTool } from '@mastra/sofya';

const searchTool = createSofyaSearchTool();

// When called by an agent, accepts:
// - query (required)
// - searchDepth: 'snippets' | 'basic'
// - maxResults: 1-20
// - includeAnswer: boolean
// - includeDomains, excludeDomains
// - topic: 'general' | 'news'
// - freshness: 'day' | 'week' | 'month' | 'year' | 'YYYY-MM-DD'
// Returns full page content per result, not just snippets.
```

### Fetch

```typescript
import { createSofyaFetchTool } from '@mastra/sofya';

const fetchTool = createSofyaFetchTool();

// Accepts: urls (1-10), includeRawHtml
// Returns: results[] as clean markdown, each with a per-url success flag.
// Supports web pages, PDFs, and documents via 250+ site-specific parsers.
```

### Extract

```typescript
import { createSofyaExtractTool } from '@mastra/sofya';

const extractTool = createSofyaExtractTool();

// Accepts: url, prompt
// Returns: content extracted from the page based on the prompt.
```

### Research

```typescript
import { createSofyaResearchTool } from '@mastra/sofya';

const researchTool = createSofyaResearchTool();

// Accepts: query, topic, freshness, maxSources (1-30)
// Returns: report (synthesized, cited) + sources[] + subQueries[]
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `process.env.SOFYA_API_KEY` | Your Sofya API key |
| `baseUrl` | `string` | `https://sofya.co/v1` | Base URL for the Sofya API |
| `clientSource` | `string` | `mastra` | Attribution string sent with each request |

If no API key is found, the tool throws a clear error at execution time.

## RAG Pairing Example

Combine search and fetch for retrieval-augmented generation:

```typescript
import { Agent } from '@mastra/core/agent';
import { createSofyaSearchTool, createSofyaFetchTool } from '@mastra/sofya';

const agent = new Agent({
  id: 'rag-agent',
  name: 'Research Assistant',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: `You are a research assistant. Use sofya-search to find relevant pages, then use sofya-fetch to read the full content of the best results.`,
  tools: {
    search: createSofyaSearchTool(),
    fetch: createSofyaFetchTool(),
  },
});
```

## License

Apache-2.0
