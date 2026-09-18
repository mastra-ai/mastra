# @mastra/code-sdk

The agent core behind [Mastra Code](https://mastra.ai) — everything except the terminal UI. Use it to build your own UIs and surfaces (web apps, editors, bots) on top of the Mastra Code coding agent.

The published [`mastracode`](https://www.npmjs.com/package/mastracode) CLI/TUI and the Mastra Code web surface are both built on this SDK.

## Installation

```bash
npm install @mastra/code-sdk
```

## Usage

Mount the Mastra Code agent controller on a Mastra instance:

```ts
import { mountAgentControllerOnMastra } from '@mastra/code-sdk';

// Creates a Mastra instance that hosts the Mastra Code agent controller
// (thread management, modes, tools, memory) and starts its workers.
const { mastra, controller } = await mountAgentControllerOnMastra({
  cwd: process.cwd(),
});
```

## Plugin background execution

With the experimental `backgroundTools.enabled` setting on, plugin tools are eligible for native background execution only when they declare their own configuration:

```ts
background: {
  enabled: true,
  defaultDisposition: 'foreground',
  maxRetries: 0,
}
```

The SDK doesn't infer support from tool names or serialize plugin calls. When the setting is off, it disables plugin-declared background execution without modifying the original tool.

Declaring support means the tool's `execute()` promise must represent the complete operation for native background calls, including cleanup. Tools that already await their work need no separate execution path. A tool that normally returns an acknowledgement while continuing independently must check `context.agent?.isBackgroundTask` and await that operation in the background path. It must also forward `context.abortSignal` and reject on failure. The plugin owns any conversation-level queue.

`defaultDisposition: 'foreground'` preserves normal calls unless the caller explicitly requests `_background.disposition: 'deferred'` or `'awaited'`. Plugins without a declaration remain usable in the foreground, including older versions of `mastra_expert`.

## Documentation

- [@mastra/code-sdk documentation](https://mastra.ai/reference/code-sdk/mount-agent-controller)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
