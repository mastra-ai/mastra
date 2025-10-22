---
title: 'Venice AI '
description: 'Use Venice AI models with Mastra. 13 models available.'
---

# <img src="https://models.dev/logos/venice.svg" alt="Venice AI logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Venice AI

Access 13 Venice AI models through Mastra's model router. Authentication is handled automatically using the `VENICE_API_KEY` environment variable.

Learn more in the [Venice AI documentation](https://docs.venice.ai).

```bash
VENICE_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful assistant',
  model: 'venice/deepseek-coder-v2-lite',
});

// Generate a response
const response = await agent.generate('Hello!');

// Stream a response
const stream = await agent.stream('Tell me a story');
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI Compatibility

Mastra uses the OpenAI-compatible `/chat/completions` endpoint. Some provider-specific features may not be available. Check the [Venice AI documentation](https://docs.venice.ai) for details.

:::

## Models

<ProviderModelsTable
models={[
{
"model": "venice/dolphin-2.9.2-qwen2-72b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 32768,
"maxOutput": 8192,
"inputCost": 0.7,
"outputCost": 2.8
},
{
"model": "venice/mistral-31-24b",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 0.5,
"outputCost": 2
},
{
"model": "venice/venice-uncensored",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 32768,
"maxOutput": 8192,
"inputCost": 0.5,
"outputCost": 2
},
{
"model": "venice/qwen-2.5-vl",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 32768,
"maxOutput": 8192,
"inputCost": 0.7,
"outputCost": 2.8
},
{
"model": "venice/qwen3-235b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 1.5,
"outputCost": 6
},
{
"model": "venice/qwen-2.5-qwq-32b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": true,
"contextWindow": 32768,
"maxOutput": 8192,
"inputCost": 0.5,
"outputCost": 2
},
{
"model": "venice/deepseek-coder-v2-lite",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 0.5,
"outputCost": 2
},
{
"model": "venice/qwen3-4b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 32768,
"maxOutput": 8192,
"inputCost": 0.15,
"outputCost": 0.6
},
{
"model": "venice/llama-3.3-70b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 65536,
"maxOutput": 8192,
"inputCost": 0.7,
"outputCost": 2.8
},
{
"model": "venice/qwen-2.5-coder-32b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 32768,
"maxOutput": 8192,
"inputCost": 0.5,
"outputCost": 2
},
{
"model": "venice/deepseek-r1-671b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": true,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 3.5,
"outputCost": 14
},
{
"model": "venice/llama-3.2-3b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 8192,
"inputCost": 0.15,
"outputCost": 0.6
},
{
"model": "venice/llama-3.1-405b",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 65536,
"maxOutput": 8192,
"inputCost": 1.5,
"outputCost": 6
}
]}
/>

## Advanced Configuration

### Custom Headers

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    url: 'https://api.venice.ai/api/v1',
    modelId: 'deepseek-coder-v2-lite',
    apiKey: process.env.VENICE_API_KEY,
    headers: {
      'X-Custom-Header': 'value',
    },
  },
});
```

### Dynamic Model Selection

```typescript
const agent = new Agent({
  name: 'dynamic-agent',
  model: ({ runtimeContext }) => {
    const useAdvanced = runtimeContext.task === 'complex';
    return useAdvanced ? 'venice/venice-uncensored' : 'venice/deepseek-coder-v2-lite';
  },
});
```
