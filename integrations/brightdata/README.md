# @mastra/brightdata

[Bright Data](https://brightdata.com) web search and web fetch tools for [Mastra](https://mastra.ai) agents.

Backed by the official [`@brightdata/sdk`](https://github.com/brightdata/sdk-js). Bright Data's SERP API and Web Unlocker bypass bot detection and CAPTCHAs, so the tools work on sites that block typical scrapers.
## Installation

```bash
npm install @mastra/brightdata
```

## Usage


Set `BRIGHTDATA_API_TOKEN` and configure the Bright Data zones used by the tools.

```typescript
import { createBrightDataTools } from '@mastra/brightdata';
import { Agent } from '@mastra/core/agent';

const { webSearch, webFetch } = createBrightDataTools();

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-5.6-sol',
  instructions: 'Search for relevant pages, then fetch the best sources before answering.',
  tools: { webSearch, webFetch },
});
```

## Documentation

- [@mastra/brightdata documentation](https://mastra.ai/integrations/tools/brightdata)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/brightdata/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
