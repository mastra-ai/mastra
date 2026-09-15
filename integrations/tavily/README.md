# @mastra/tavily

Add Tavily search, extract, crawl, and map tools to Mastra agents with shared configuration, typed Zod schemas, and structured web results.
## Installation

```bash
npm install @mastra/tavily
```

## Usage


Set `TAVILY_API_KEY` before creating the tools.

```typescript
import { Agent } from '@mastra/core/agent';
import { createTavilyExtractTool, createTavilySearchTool } from '@mastra/tavily';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-5.6-sol',
  instructions: 'Search for relevant pages, then extract the best sources before answering.',
  tools: {
    search: createTavilySearchTool(),
    extract: createTavilyExtractTool(),
  },
});
```

## Documentation

- [Tavily](https://mastra.ai/integrations/tools/tavily)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/tavily/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
