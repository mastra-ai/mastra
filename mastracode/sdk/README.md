# @mastra/code-sdk

Mastra Code SDK: the agent core behind Mastra Code (everything except the TUI) — build your own UIs and surfaces on top of it. Use `@mastra/code-sdk` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/code-sdk
```

## Usage

```ts
import { loadSettings } from '@mastra/code-sdk/onboarding/settings';

const settings = loadSettings();
console.log(settings.storage.backend);
```

## Documentation

- [@mastra/code-sdk documentation](https://mastra.ai/reference/code-sdk/mount-agent-controller)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
