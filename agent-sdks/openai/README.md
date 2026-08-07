# @mastra/openai

`@mastra/openai` connects Mastra to the OpenAI Agents SDK. Use it when you want to register an OpenAI SDK agent with Mastra and call it through Mastra-compatible `generate()` and `stream()` methods.

## Installation

```bash
npm install @mastra/openai @openai/agents
```

## Overview

The package exports `OpenAISDKAgent`, a Mastra `Agent` wrapper around the OpenAI Agents SDK run loop.

`OpenAISDKAgent` keeps the OpenAI SDK run loop in charge. Mastra receives compatible outputs, usage data, and tracing data for the run.

## Create an OpenAI SDK agent

Pass OpenAI Agents SDK configuration through `sdkOptions`. `OpenAISDKAgent` creates the SDK agent on first use.

```typescript
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

You can also pass an existing OpenAI SDK agent when your app already creates or owns it.

```typescript
import { Agent as OpenAIAgent } from '@openai/agents';
import { OpenAISDKAgent } from '@mastra/openai';

const sdkAgent = new OpenAIAgent({
  name: 'Repository assistant',
  instructions: 'Answer clearly and cite the relevant files.',
  model: '__GATEWAY_OPENAI_MODEL_BASE__',
});

export const openaiAgent = new OpenAISDKAgent({
  id: 'openai-sdk-agent',
  description: 'Use OpenAI Agents SDK through Mastra.',
  agent: sdkAgent,
});
```

You can register the wrapper anywhere Mastra accepts an `Agent`.

```typescript
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  agents: {
    openaiAgent,
  },
});
```

## Run the agent

```typescript
const result = await openaiAgent.generate('Summarize the latest changes in this repository.', {
  runId: 'openai-run',
  maxSteps: 3,
});

console.log(result.text);
```

```typescript
const stream = await openaiAgent.stream('Review this package for test gaps.');

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'text-delta') {
    process.stdout.write(chunk.payload.text);
  }
}
```

## Configure OpenAI

`OpenAISDKAgent` forwards `sdkOptions` to the OpenAI SDK `Agent` constructor when `agent` is not provided. These include `name`, `instructions`, `model`, `tools`, `handoffs`, guardrails, and other OpenAI Agents SDK agent settings.

Mastra `generate()` and `stream()` execution options drive the run. `maxSteps` maps to OpenAI `maxTurns`, and `abortSignal` maps to OpenAI `signal`.
