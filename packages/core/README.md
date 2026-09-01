# @mastra/core

Utilities for using @mastra/core with Mastra. Install `@mastra/core` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/core
```

## Usage

Configure a model that is available to your project.

```typescript
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'assistant',
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-5.6-sol',
});
```

## Documentation

- [@mastra/core documentation](https://mastra.ai/docs/agents/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/core/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
