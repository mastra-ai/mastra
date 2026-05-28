# @mastra/exa

[Exa](https://exa.ai) AI-powered web search, content retrieval, find-similar, and answer tools for [Mastra](https://mastra.ai) agents.

## Installation

```bash
npm install @mastra/exa exa-js zod
```

## Quick Start

Use `createExaTools()` to get all four tools with a shared configuration:

```typescript
import { Agent } from '@mastra/core/agent';
import { createExaTools } from '@mastra/exa';

const tools = createExaTools();
// Or pass an explicit API key:
// const tools = createExaTools({ apiKey: 'your-exa-api-key' });

const agent = new Agent({
  id: 'realtime-information-agent',
  name: 'Realtime Information Agent',
  instructions:
    'You are a realtime information agent. Use exa-search for fresh web results, exa-get-contents to read full pages, exa-find-similar to expand from a known good URL, and exa-answer for direct fact-finding.',
  model: 'anthropic/claude-sonnet-4-6',
  tools,
});
```

By default, the tools read `EXA_API_KEY` from your environment. You can also pass `{ apiKey }` explicitly.

## Individual Tools

Each tool can be created independently:

```typescript
import { createExaSearchTool, createExaGetContentsTool } from '@mastra/exa';

const searchTool = createExaSearchTool({ apiKey: 'your-exa-api-key' });
const contentsTool = createExaGetContentsTool(); // uses EXA_API_KEY env var
```

### Search

```typescript
import { createExaSearchTool } from '@mastra/exa';

const searchTool = createExaSearchTool();

// When called by an agent, accepts:
// - query (required)
// - type: 'auto' | 'neural' | 'keyword' | 'hybrid' | 'fast' | 'instant'
// - numResults: 1-100
// - includeDomains, excludeDomains, includeText, excludeText
// - category: 'company' | 'research paper' | 'news' | 'pdf' | 'personal site' | 'financial report' | 'people'
// - startPublishedDate, endPublishedDate, startCrawlDate, endCrawlDate
// - userLocation (ISO country code)
// - text, highlights, summary (boolean or object — request multiple at once)
// - livecrawl: 'never' | 'fallback' | 'always' | 'auto' | 'preferred'
```

### Get Contents

```typescript
import { createExaGetContentsTool } from '@mastra/exa';

const contentsTool = createExaGetContentsTool();

// Accepts: urls (1+), text, highlights, summary, livecrawl, livecrawlTimeout, subpages, subpageTarget
// Returns: results[] with id, url, title, text, highlights, summary, etc.
```

### Find Similar

```typescript
import { createExaFindSimilarTool } from '@mastra/exa';

const similarTool = createExaFindSimilarTool();

// Accepts: url, numResults, excludeSourceDomain, includeDomains, excludeDomains,
//          includeText, excludeText, category, date filters, text/highlights/summary
// Returns: scored similar pages with optional content
```

### Answer

```typescript
import { createExaAnswerTool } from '@mastra/exa';

const answerTool = createExaAnswerTool();

// Accepts: query, text (include citation page text), systemPrompt, userLocation
// Returns: answer string + citations[]
```

## Configuration

| Option    | Type     | Default                      | Description                                                |
| --------- | -------- | ---------------------------- | ---------------------------------------------------------- |
| `apiKey`  | `string` | `process.env.EXA_API_KEY`    | Your Exa API key                                           |
| `baseURL` | `string` | Exa default                  | Override the API base URL (proxies / self-hosted gateways) |

If no API key is found, the tool throws a clear error at execution time.

## RAG Pairing Example

Combine search and content retrieval for retrieval-augmented generation:

```typescript
import { Agent } from '@mastra/core/agent';
import { createExaSearchTool, createExaGetContentsTool } from '@mastra/exa';

const agent = new Agent({
  id: 'rag-agent',
  name: 'Research Assistant',
  model: 'anthropic/claude-sonnet-4-6',
  instructions:
    'You are a research assistant. Use exa-search to find relevant pages, then use exa-get-contents to fetch full text or summaries from the best results.',
  tools: {
    search: createExaSearchTool(),
    contents: createExaGetContentsTool(),
  },
});
```

## License

Apache-2.0
