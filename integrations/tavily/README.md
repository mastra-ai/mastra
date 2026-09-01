# @mastra/tavily

Tavily web search, extract, crawl, and map tools for Mastra agents. Use `@mastra/tavily` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/tavily
```

## Usage

```typescript
import { createTavilyExtractTool } from '@mastra/tavily';

const extractTool = createTavilyExtractTool();

// Accepts: urls (1-20), extractDepth, includeImages, format ('markdown' | 'text')
// Returns: results[] + failedResults[]
```

## Documentation

- [@mastra/tavily documentation](https://mastra.ai/integrations/tools/tavily)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/tavily/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
