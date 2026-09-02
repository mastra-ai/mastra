# @mastra/memory

`@mastra/memory` gives Mastra agents persistent conversation history, semantic recall, working memory, and observational memory. Attach a `Memory` instance to an agent when it should retain context across messages and threads.

## Installation

```bash
npm install @mastra/memory
```

## Usage

Attach memory to an agent and pass a stable thread and resource ID when generating a response.

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

const agent = new Agent({
  id: 'support-agent',
  name: 'Support agent',
  instructions: 'Answer support questions using the conversation history.',
  model: 'openai/gpt-5.6-sol',
  memory: new Memory(),
});

const response = await agent.generate('What did we discuss last time?', {
  memory: { thread: 'conversation-123', resource: 'user-456' },
});
```

## Documentation

- [@mastra/memory documentation](https://mastra.ai/docs/memory/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/memory/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
