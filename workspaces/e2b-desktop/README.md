# @mastra/e2b-desktop

E2B Desktop (computer-use) sandbox provider for Mastra workspaces.

Runs a full Linux desktop environment in an [E2B](https://e2b.dev) cloud sandbox with screenshot, mouse, and keyboard control. Extends [`@mastra/e2b`](../e2b)'s `E2BSandbox` the same way [`@e2b/desktop`](https://github.com/e2b-dev/desktop)'s SDK extends `e2b`'s — everything the base provider supports (command execution, processes, file upload, pause/resume reconnection) works against the same desktop VM.

## Installation

```bash
npm install @mastra/e2b-desktop
```

Requires an E2B API key (`E2B_API_KEY` env var or the `apiKey` option).

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { E2BDesktopSandbox } from '@mastra/e2b-desktop';

const sandbox = new E2BDesktopSandbox({ resolution: [1280, 720] });

const agent = new Agent({
  name: 'desktop-agent',
  instructions: 'You can control a Linux desktop and run shell commands.',
  model: 'anthropic/claude-sonnet-4-6',
  // file + shell + computer tools are all emitted automatically
  workspace: new Workspace({ sandbox }),
});
```

With a `Workspace`, agents automatically get the `mastra_workspace_computer_*` tools (screenshot, click, type, press key, scroll, drag, …) alongside the shell and process tools.

### Direct desktop control

```typescript
const sandbox = new E2BDesktopSandbox();
await sandbox.start();

await sandbox.computer.leftClick(100, 200);
await sandbox.computer.type('hello');
const { data } = await sandbox.computer.screenshot(); // PNG bytes

// Live desktop view (authenticated noVNC URL)
const viewerUrl = await sandbox.computer.streamUrl();
```

### Raw SDK escape hatch

Desktop-only APIs (`launch`, `open`, window helpers, custom stream control) are available on the underlying `@e2b/desktop` sandbox:

```typescript
await sandbox.desktop.launch('xfce4-terminal');
await sandbox.desktop.open('https://mastra.ai');
```

## Options

All [`E2BSandboxOptions`](../e2b) plus:

| Option       | Type               | Description                                       |
| ------------ | ------------------ | ------------------------------------------------- |
| `resolution` | `[number, number]` | Desktop resolution in pixels (new sandboxes only) |
| `dpi`        | `number`           | Desktop display DPI (new sandboxes only)          |

When no `template` is provided, the E2B-hosted `desktop` template is used. Note: the desktop template has no FUSE tooling, so cloud filesystem mounting requires a custom desktop template with `s3fs`/`gcsfuse` installed.

## License

Apache-2.0
