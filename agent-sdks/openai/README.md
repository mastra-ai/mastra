# @mastra/openai

`@mastra/openai` connects Mastra to the OpenAI Agents SDK. Use it when you want the OpenAI SDK's native agent loop, handoffs, and tools while exposing the agent through Mastra-compatible `generate()` and `stream()` methods.

## Installation

```bash
npm install @mastra/openai
npm install @openai/agents
```

## Usage

Set `OPENAI_API_KEY` before creating the agent.

```typescript
import { Mastra } from '@mastra/core/mastra';
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

export const mastra = new Mastra({
  agents: { openaiAgent },
});
```

## Documentation

- [OpenAI Agents SDK integration](https://mastra.ai/docs/connections/sdk-agents#openai-agents-sdk)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/agent-sdks/openai/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
