# @mastra/ai-sdk

Adds custom API routes to be compatible with the AI SDK UI parts. Install `@mastra/ai-sdk` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/ai-sdk
```

## Usage

Register the route in a Mastra server configuration.

```typescript
import { chatRoute } from '@mastra/ai-sdk';

const route = chatRoute({ path: '/chat/:agentId' });
```

## Documentation

- [@mastra/ai-sdk documentation](https://mastra.ai/reference/ai-sdk/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/client-sdks/ai-sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
