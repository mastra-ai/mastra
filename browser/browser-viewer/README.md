# @mastra/browser-viewer

Playwright-based browser viewer for Mastra workspaces with CLI provider support.

## Overview

`@mastra/browser-viewer` provides `BrowserViewer`, which launches Chrome via Playwright and exposes the CDP URL for CLI tools (agent-browser, browser-use, browse-cli) to connect. This gives you:

- **Full screencast support** — Direct page-level CDP sessions
- **Input injection** — Mouse and keyboard events work correctly
- **Browser lifecycle control** — Browser starts/stops with the server
- **CLI flexibility** — Agent uses skills + workspace commands to drive any CLI

## Installation

```bash
npm install @mastra/browser-viewer
# or
pnpm add @mastra/browser-viewer
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

### Connect to Existing Browser

```typescript
import { BrowserViewer } from '@mastra/browser-viewer';

const viewer = new BrowserViewer({
  cli: 'agent-browser',
  cdpUrl: 'ws://127.0.0.1:9222/devtools/browser/abc123',
});
```

### With Workspace (coming soon)

The CDP URL will be automatically injected into CLI commands when used with workspace tools.

```typescript
// Agent runs: agent-browser open https://google.com
// Mastra injects: agent-browser open https://google.com --cdp-url ws://...
```

## Configuration

| Option           | Type                                               | Default    | Description                                      |
| ---------------- | -------------------------------------------------- | ---------- | ------------------------------------------------ |
| `cli`            | `'agent-browser' \| 'browser-use' \| 'browse-cli'` | Required   | Which CLI the agent uses                         |
| `cdpUrl`         | `string`                                           | -          | Connect to existing browser instead of launching |
| `headless`       | `boolean`                                          | `false`    | Run browser in headless mode                     |
| `cdpPort`        | `number`                                           | `0` (auto) | Port for Chrome remote debugging                 |
| `viewport`       | `{ width, height }`                                | `1280x720` | Browser viewport size                            |
| `userDataDir`    | `string`                                           | -          | Chrome profile directory                         |
| `executablePath` | `string`                                           | -          | Path to Chrome executable                        |

## How It Works

1. **BrowserViewer launches Chrome** via Playwright with `--remote-debugging-port`
2. **Agent calls CLI commands** via `workspace_execute_command`
3. **CDP URL is auto-injected** so CLI connects to Mastra-managed Chrome
4. **Screencast streams** directly from page-level CDP sessions
5. **Browser closes** when server exits

## Supported CLIs

- **agent-browser** — Vercel's browser automation CLI
- **browser-use** — Python-based browser automation
- **browse-cli** — Browserbase's Stagehand CLI

## License

Apache-2.0
