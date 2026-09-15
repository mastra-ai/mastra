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

For credentialed servers that must not discover configuration or capabilities
from the host machine, import `mountRestrictedAgentControllerOnMastra` from
`@mastra/code-sdk/restricted`. The restricted factory requires an explicit
model, workspace, storage, project identity, modes, instructions, and tool
allowlist.

## Documentation

- [@mastra/code-sdk documentation](https://mastra.ai/reference/code-sdk/mount-agent-controller)
- [Restricted server embedding](https://mastra.ai/reference/code-sdk/mount-restricted-agent-controller)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
