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
  coAuthor: {
    name: 'my-coding-app',
    email: 'my-coding-app@example.com',
  },
});
```

### Commit attribution

`coAuthor` controls the `Co-Authored-By` trailer included in coding-agent commit guidance. Both fields are optional: an omitted field uses the SDK's `mastra-platform[bot]` name or `284800079+mastra-platform[bot]@users.noreply.github.com` email default.

The `mastracode` TUI sets only its name to `mastracode`; Factory sets its name to `mastra-platform[bot]`. They intentionally share the default email, so GitHub resolves both trailers to the same bot account while preserving the app name in the raw commit message.

## Documentation

- [@mastra/code-sdk documentation](https://mastra.ai/reference/code-sdk/mount-agent-controller)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
