# @mastra/ceramic

Add Ceramic web search to Mastra agents with typed Zod inputs and outputs. Ceramic is a fast keyword search engine that returns ranked web results with titles, URLs, and page content.

## Installation

```bash
npm install @mastra/ceramic
```

## Usage

Set `CERAMIC_API_KEY` before creating the tools. You can get an API key from the [Ceramic platform](https://platform.ceramic.ai/keys).

```typescript
import { Agent } from '@mastra/core/agent';
import { createCeramicTools } from '@mastra/ceramic';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-5.6-sol',
  instructions: 'Search the web with specific keyword queries. Try several keyword variations and combine the results.',
  tools: createCeramicTools(),
});
```

## Documentation

- [Ceramic](https://mastra.ai/integrations/tools/ceramic)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/ceramic/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
