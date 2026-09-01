# @mastra/brightdata

Bright Data web search and web fetch tools for Mastra agents. Use `@mastra/brightdata` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/brightdata
```

## Usage

```typescript
import { createBrightDataFetchTool } from '@mastra/brightdata';

const fetchTool = createBrightDataFetchTool();

// Accepts: url (required)
// Returns: { url, content }  // content is Markdown
```

## Documentation

- [@mastra/brightdata documentation](https://mastra.ai/integrations/tools/brightdata)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/brightdata/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
