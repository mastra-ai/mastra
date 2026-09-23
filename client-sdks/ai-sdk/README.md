# @mastra/ai-sdk

The recommended way of using Mastra and AI SDK together is by installing the `@mastra/ai-sdk` package. `@mastra/ai-sdk` provides custom API routes and utilities for streaming Mastra agents in AI SDK-compatible formats. Including chat, workflow, and network route handlers, along with utilities and exported types for UI integrations.

## Installation

```bash
npm install @mastra/ai-sdk
```

## Usage

If you want to use dynamic agents you can use a path with `:agentId`.

```typescript
import { chatRoute } from '@mastra/ai-sdk';

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      chatRoute({
        path: '/chat/:agentId',
      }),
    ],
  },
});
```

## Documentation

- [AI SDK UI integration guide](https://mastra.ai/integrations/agentic-ui/ai-sdk-ui)
- [AI SDK reference](https://mastra.ai/reference/ai-sdk/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/client-sdks/ai-sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
