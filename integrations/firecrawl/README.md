# @mastra/firecrawl

Add Firecrawl Search and Scrape tools to Mastra agents with typed Zod inputs and outputs and clean Markdown page content.

## Installation

```bash
npm install @mastra/firecrawl
```

## Usage

Set `FIRECRAWL_API_KEY` before creating the tools.

```typescript
import { Agent } from '@mastra/core/agent';
import { createFirecrawlTools } from '@mastra/firecrawl';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-5.6-sol',
  instructions: 'Search the web, then scrape the most relevant pages for details.',
  tools: createFirecrawlTools(),
});
```

## Documentation

- [Firecrawl](https://mastra.ai/integrations/tools/firecrawl)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/firecrawl/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
