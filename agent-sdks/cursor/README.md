# @mastra/cursor

Cursor SDK package for Mastra. Use `@mastra/cursor` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/cursor
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { CursorSDKAgent } from '@mastra/cursor';

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
```

## Documentation

- [@mastra/cursor documentation](https://mastra.ai/reference/acp/acp-agent)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/agent-sdks/cursor/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
