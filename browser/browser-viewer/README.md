# @mastra/browser-viewer

Run CLI browser tools through BrowserViewer with a Playwright-managed Chrome session, CDP access, live viewing, and Mastra workspace integration.

## Installation

```bash
npm install @mastra/browser-viewer
```

## Usage

### Basic Setup

```typescript
import { BrowserViewer } from '@mastra/browser-viewer';

const viewer = new BrowserViewer({
  cli: 'agent-browser', // Which CLI the agent will use
  headless: false, // Show browser window
});

// Launch browser
await viewer.launch();

// Get CDP URL for CLIs to connect
const cdpUrl = await viewer.getCdpUrl();
console.log(cdpUrl); // ws://127.0.0.1:9222/devtools/browser/...
```

## Documentation

- [BrowserViewer](https://mastra.ai/integrations/browsers/browser-viewer)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/browser/browser-viewer/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
