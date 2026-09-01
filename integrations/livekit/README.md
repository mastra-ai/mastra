# @mastra/livekit

LiveKit voice integration for Mastra agents — realtime voice with semantic turn detection and barge-in. Use `@mastra/livekit` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/livekit
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { createEndCallTool } from '@mastra/livekit';

// in your agent's tools:
endCall: createEndCallTool({
  // optional bookkeeping — the tool reads the caller identity from its context
  onEndCall: ({ reason, resourceId }) => log.info('agent ended call', { reason, resourceId }),
}),
```

## Documentation

- [@mastra/livekit documentation](https://mastra.ai/integrations/voice/livekit)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/integrations/livekit/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
