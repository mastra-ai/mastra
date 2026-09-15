# @mastra/browser-firecrawl

Give Mastra agents remote browser automation with Firecrawl Browser Sandbox sessions, deterministic interaction tools, and self-hosted configuration.

## Installation

```bash
npm install @mastra/browser-firecrawl
```

## Usage

```typescript
import { FirecrawlBrowser } from '@mastra/browser-firecrawl';

const browser = new FirecrawlBrowser({
  apiKey: process.env.FIRECRAWL_API_KEY!,
});
```

## Documentation

- [Firecrawl](https://mastra.ai/integrations/browsers/firecrawl)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/browser/firecrawl/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
