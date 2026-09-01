# @mastra/openai

OpenAI Agents SDK package for Mastra. Use `@mastra/openai` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/openai
```

## Usage

```typescript
import { OpenAISDKAgent } from '@mastra/openai';

export const openaiAgent = new OpenAISDKAgent({
  id: 'openai-sdk-agent',
  name: 'OpenAI SDK Agent',
  description: 'Use OpenAI Agents SDK through Mastra.',
  sdkOptions: {
    name: 'Repository assistant',
    instructions: 'Answer clearly and cite the relevant files.',
    model: 'openai/gpt-5.6-sol',
  },
});
```

## Documentation

- [@mastra/openai documentation](https://mastra.ai/docs/connections/sdk-agents)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/agent-sdks/openai/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
