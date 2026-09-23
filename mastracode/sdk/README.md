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

### Plugin background execution

With the experimental `backgroundTools.enabled` setting on, plugin tools are eligible for native background execution only when they declare their own configuration:

```ts
background: {
  enabled: true,
  defaultDisposition: 'foreground',
  maxRetries: 0,
}
```

The SDK doesn't infer support from tool names or serialize plugin calls. When the setting is off, it disables plugin-declared background execution without modifying the original tool.

Tools that already await their work need no separate execution path. For a tool that returns an acknowledgement while continuing independently, native execution exposes `context.background`. Adopt the existing operation before returning:

```ts
const operation = startResearch(input, context.abortSignal);
if (context.background) {
  context.background.adopt({
    completion: operation.finished,
    cancel: reason => operation.cancel(reason),
  });
  return { answer: 'Research started' };
}
return await operation.finished;
```

Here, `startResearch` represents the plugin's own operation API. Its `finished` promise must resolve with the terminal tool result only after work and cleanup finish, or reject on failure. The native task tracks that promise instead of the acknowledgement. Adopt at most one operation, before `execute()` returns. Forward cancellation through the supplied signal or the operation's `cancel` callback. Without adoption, `execute()` must itself await the complete operation.

The handle stays in memory and isn't restart-safe. The plugin still owns its conversation-level queue and answer signals. Adoption doesn't suppress host completion notifications; keep progress rendering active until the adopted operation finishes.

`defaultDisposition: 'foreground'` preserves normal calls unless the caller explicitly requests `_background.disposition: 'deferred'` or `'awaited'`. Plugins without a declaration remain usable in the foreground, including older versions of `mastra_expert`.

## Documentation

- [@mastra/code-sdk documentation](https://mastra.ai/reference/code-sdk/mount-agent-controller)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
