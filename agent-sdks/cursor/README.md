# @mastra/cursor

`@mastra/cursor` connects Mastra to the Cursor Agent SDK. Use it when you want Cursor's coding-agent runtime and repository tools while exposing the agent through Mastra-compatible `generate()` and `stream()` methods.

## Installation

```bash
npm install @mastra/cursor
npm install @cursor/sdk
```

## Usage

Set `CURSOR_API_KEY` before creating the agent.

```typescript
import { CursorSDKAgent } from '@mastra/cursor';
import { Mastra } from '@mastra/core/mastra';

export const cursorAgent = new CursorSDKAgent({
  id: 'cursor-sdk-agent',
  name: 'Cursor SDK Agent',
  description: 'Use Cursor Agent SDK through Mastra.',
  sdkOptions: {
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: process.env.CURSOR_MODEL_ID! },
    local: {
      cwd: process.cwd(),
    },
  },
});

export const mastra = new Mastra({
  agents: { cursorAgent },
});
```

## Documentation

- [Cursor Agent SDK integration](https://mastra.ai/docs/connections/sdk-agents#cursor-agent-sdk)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/agent-sdks/cursor/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
