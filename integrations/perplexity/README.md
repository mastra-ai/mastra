# @mastra/perplexity

Perplexity Search tool for Mastra agents. Use `@mastra/perplexity` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/perplexity
```

## Usage

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

## Documentation

- [@mastra/perplexity documentation](https://mastra.ai/integrations/tools/perplexity)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/perplexity/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
