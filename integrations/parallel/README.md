# @mastra/parallel

Parallel web search and content extraction tools for [Mastra](https://mastra.ai) agents.

## Installation

```bash
npm install @mastra/parallel parallel-web zod
```

## Quick start

Use `createParallelTools()` to create Search and Extract tools with shared client configuration:

```typescript
import { Agent } from '@mastra/core/agent';
import { createParallelTools } from '@mastra/parallel';

const agent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Search the web for current sources, then extract relevant content from the best pages.',
  tools: createParallelTools(),
});
```

The tools read `PARALLEL_API_KEY` from the environment when you don't pass a key explicitly.

## Individual tools

Create either tool independently when an agent doesn't need both:

```typescript
import { createParallelExtractTool, createParallelSearchTool } from '@mastra/parallel';

const search = createParallelSearchTool({ apiKey: 'parallel-api-key' });
const extract = createParallelExtractTool();
```

### Search

`createParallelSearchTool()` creates the `parallel-search` tool. It accepts one or more keyword queries and optional objective, mode, model, result, domain, location, freshness, character, and session controls. Results include ranked URLs and focused excerpts.

### Extract

`createParallelExtractTool()` creates the `parallel-extract` tool. It accepts 1-20 URLs and optional objective, query, model, excerpt, full-content, freshness, character, and session controls. The result separates successful pages from per-URL errors.

## Configuration

All factories accept `ParallelClientOptions`, an alias of the official `ClientOptions` type from `parallel-web`. This includes `apiKey`, `baseURL`, `timeout`, `fetch`, `maxRetries`, request headers, and logging options. The API key defaults to `PARALLEL_API_KEY`.

The package also exports `getParallelClient()` when an application needs the configured official client directly:

```typescript
import { getParallelClient } from '@mastra/parallel';

const client = getParallelClient({ apiKey: 'parallel-api-key' });
```

## License

Apache-2.0
