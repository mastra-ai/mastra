# @mastra/perplexity

Web search tool for [Mastra](https://mastra.ai) agents, backed by the [Perplexity Search API](https://docs.perplexity.ai/docs/search/quickstart).

## Installation

```bash
npm install @mastra/perplexity zod
```

## Quick Start

```typescript
import { Agent } from '@mastra/core/agent';
import { createPerplexitySearchTool } from '@mastra/perplexity';

const agent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions:
    'You are a research assistant. Use the perplexity-search tool to find up-to-date information from the web before answering.',
  tools: {
    search: createPerplexitySearchTool(),
  },
});
```

The tool reads `PERPLEXITY_API_KEY` (or `PPLX_API_KEY` as a fallback) from the environment. Pass `{ apiKey }` explicitly to override.

## Filtering

The Search API supports filtering by domain and date. All filters are optional.

```typescript
const tool = createPerplexitySearchTool();

await tool.execute!({
  query: 'recent papers on agent evaluation',
  maxResults: 10,
  searchRecencyFilter: 'month',
  searchDomainFilter: ['arxiv.org', 'openreview.net'],
}, {} as any);
```

To exclude domains, prefix them with `-`. Don't mix allow- and deny-list entries in the same call.

```typescript
searchDomainFilter: ['-pinterest.com', '-quora.com'];
```

## Using Perplexity as a Model Provider

Perplexity is also a first-class model provider in Mastra's model router. To chat with Perplexity models (separate from this search tool), set `PERPLEXITY_API_KEY` and reference the model directly:

```typescript
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'agent-api',
  name: 'Perplexity Agent',
  model: 'perplexity-agent/openai/gpt-5',
  instructions: 'You are a research assistant powered by the Perplexity Agent API.',
});
```

See the [Perplexity provider docs](https://mastra.ai/models/providers/perplexity) and [Perplexity Agent provider docs](https://mastra.ai/models/providers/perplexity-agent).

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `PERPLEXITY_API_KEY` → `PPLX_API_KEY` | Perplexity API key. |
| `baseUrl` | `string` | `https://api.perplexity.ai` | Override the API base URL (useful for proxies and tests). |
| `fetch` | `typeof fetch` | global `fetch` | Inject a custom `fetch` implementation. |

## License

Apache-2.0
