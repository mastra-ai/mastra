---
"@mastra/openai": minor
---

Added `@mastra/openai`, a new package for using OpenAI Agents SDK agents in Mastra.

`OpenAISDKAgent` lets you register an OpenAI Agents SDK agent with Mastra, call it with Mastra-compatible `generate()` and `stream()` methods, and keep usage and tracing data connected to the Mastra run.

```ts
import { OpenAISDKAgent } from '@mastra/openai';

export const openaiAgent = new OpenAISDKAgent({
  id: 'openai-sdk-agent',
  name: 'OpenAI SDK Agent',
  description: 'Use OpenAI Agents SDK through Mastra.',
  sdkOptions: {
    name: 'Repository assistant',
    instructions: 'Answer clearly and cite the relevant files.',
    model: '__GATEWAY_OPENAI_MODEL_BASE__',
  },
});
```

Use `sdkOptions` when you want Mastra to create the OpenAI SDK agent. Pass `agent` when your app already creates and owns the SDK agent.
