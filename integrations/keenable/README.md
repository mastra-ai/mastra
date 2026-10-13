# @mastra/keenable

Web search and page fetch tools for [Mastra](https://mastra.ai) agents, backed by the [Keenable API](https://docs.keenable.ai/api-reference).

## Installation

```bash
npm install @mastra/keenable
```

## Usage

The tools work without an API key, on Keenable's keyless endpoints, which are rate limited. Set `KEENABLE_API_KEY` to raise the limit.

```typescript
import { Agent } from '@mastra/core/agent';
import { createKeenableTools } from '@mastra/keenable';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-5.6-sol',
  instructions: 'Use web search to find current sources, and read a page before quoting it.',
  tools: createKeenableTools(),
});
```

## Documentation

- [@mastra/keenable documentation](https://mastra.ai/integrations/tools/keenable)

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
