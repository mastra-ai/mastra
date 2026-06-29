# @mastra/scavio

[Scavio](https://scavio.dev) real-time search tools for [Mastra](https://mastra.ai) agents — Google, YouTube, Amazon, Walmart, Reddit, TikTok, and Instagram, with one API key.

## Installation

```bash
npm install @mastra/scavio
```

## Setup

Get a Scavio API key from the [Scavio Dashboard](https://dashboard.scavio.dev) (new accounts get free credits, no credit card). Set `SCAVIO_API_KEY` or pass `{ apiKey }`.

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { createScavioTools } from '@mastra/scavio';

const agent = new Agent({
  id: 'web-search-agent',
  name: 'Web Search Agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Search the web, shopping sites, and social platforms with Scavio.',
  tools: createScavioTools(), // reads SCAVIO_API_KEY
});
```

Use a single tool instead of the full set:

```typescript
import { createScavioGoogleSearchTool } from '@mastra/scavio';

const agent = new Agent({
  id: 'search-agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Search Google with Scavio.',
  tools: { googleSearch: createScavioGoogleSearchTool({ apiKey: process.env.SCAVIO_API_KEY }) },
});
```

## Tools

`createScavioTools()` returns: `scavioGoogleSearch`, `scavioAmazonSearch`, `scavioAmazonProduct`, `scavioWalmartSearch`, `scavioWalmartProduct`, `scavioYoutubeSearch`, `scavioYoutubeMetadata`, `scavioRedditSearch`, `scavioRedditPost`, `scavioTiktokSearch`, `scavioTiktokProfile`, `scavioInstagramSearch`, `scavioInstagramProfile`.

Each tool returns the structured Scavio JSON response. The full Scavio API (33 endpoints) is also available directly via the [`scavio`](https://www.npmjs.com/package/scavio) SDK or the [MCP server](https://scavio.dev/docs).

## Credits

Most calls cost 1 credit. Reddit and Instagram cost 2 credits, and Google costs 2 unless `light_request` is set (1 credit). See [scavio.dev/docs](https://scavio.dev/docs).
