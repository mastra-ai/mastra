# @mastra/context

Add Context.dev web search and Markdown scraping tools to Mastra agents with shared configuration, Zod input/output schemas, and structured results.

## Installation

```bash
npm install @mastra/context @mastra/core zod
```

Set `CONTEXT_DEV_API_KEY` in your server environment. Keep the key out of browser code and source control.

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { createContextTools } from '@mastra/context';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-6.1-sol',
  instructions: 'Search for relevant pages, scrape primary sources, and cite their URLs.',
  tools: createContextTools(),
});
```

`createContextTools()` returns `{ contextSearch, contextScrape }`. Use `createContextSearchTool()` or `createContextScrapeTool()` to register tools individually.

All factories accept the official `context.dev` SDK client options, including `apiKey`, `timeout` (milliseconds), and `maxRetries`. An explicit `apiKey` takes precedence over `CONTEXT_DEV_API_KEY`. Clients are initialized on first execution, so missing credentials do not prevent tool registration.

Search accepts `query`, optional `numResults` (1–100, default 10), domain filters, and a `freshness` window. It returns source titles, URLs, descriptions, relevance labels, request ID, cache metadata, and an optional partial-results flag.

Scrape accepts a single HTTP(S) `url`, optional `mainContentOnly` (default `true`), and `maxAgeMs` (0–31,536,000,000 milliseconds). Omitting `maxAgeMs` uses Context.dev's cache default; set it to `0` for a fresh scrape. Failed or empty Markdown outputs throw even when the API returns HTTP 200. Successful output includes the source URL, Markdown, request ID, and cache metadata. HTTP errors are propagated from the SDK. Mastra's execution abort signal is forwarded to both API calls.

This package exposes search and Markdown scraping, not the full hosted MCP catalog. It does not change Mastra Code's built-in web providers.

## Documentation

- [Context.dev integration guide](https://mastra.ai/integrations/tools/context)
- [Context.dev TypeScript SDK](https://docs.context.dev/sdks/typescript.md)
