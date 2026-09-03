# @mastra/parallel

Add Parallel Search and Extract tools to Mastra agents with typed Zod inputs and outputs, configurable processors, and structured web research results.
## Installation

```bash
npm install @mastra/parallel
```

## Usage


Set `PARALLEL_API_KEY` before creating the tools.

```typescript
import { Agent } from '@mastra/core/agent';
import { createParallelTools } from '@mastra/parallel';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-5.6-sol',
  instructions: 'Search the web, then extract relevant content from the best sources.',
  tools: createParallelTools(),
});
```

## Documentation

- [Parallel](https://mastra.ai/integrations/tools/parallel)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/parallel/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
