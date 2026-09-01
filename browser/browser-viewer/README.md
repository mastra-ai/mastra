# @mastra/browser-viewer

Playwright-based browser viewer for Mastra CLI providers. Use `@mastra/browser-viewer` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/browser-viewer
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { BrowserViewer } from '@mastra/browser-viewer';

const viewer = new BrowserViewer({
  cli: 'agent-browser',
  cdpUrl: 'ws://127.0.0.1:9222/devtools/browser/abc123',
});
```

## Documentation

- [@mastra/browser-viewer documentation](https://mastra.ai/reference/browser/browser-viewer)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/browser/browser-viewer/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
