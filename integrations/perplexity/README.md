# @mastra/perplexity

Web search tool for [Mastra](https://mastra.ai) agents, backed by the [Perplexity Search API](https://docs.perplexity.ai/docs/search/quickstart).
## Installation

```bash
npm install @mastra/perplexity
```

## Usage


Set `PERPLEXITY_API_KEY` before creating the search tool.

```typescript
import { Agent } from '@mastra/core/agent';
import { createPerplexitySearchTool } from '@mastra/perplexity';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-5.6-sol',
  instructions: 'Use web search to find current sources before answering.',
  tools: {
    search: createPerplexitySearchTool(),
  },
});
```

## Documentation

- [@mastra/perplexity documentation](https://mastra.ai/integrations/tools/perplexity)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/perplexity/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
