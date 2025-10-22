---
title: 'Anthropic '
description: 'Use Anthropic models with Mastra. 11 models available.'
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# <img src="https://models.dev/logos/anthropic.svg" alt="Anthropic logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Anthropic

Access 11 Anthropic models through Mastra's model router. Authentication is handled automatically using the `ANTHROPIC_API_KEY` environment variable.

Learn more in the [Anthropic documentation](https://docs.anthropic.com/en/docs/about-claude/models).

```bash
ANTHROPIC_API_KEY=your-api-key
```

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful assistant',
  model: 'anthropic/claude-3-5-haiku-20241022',
});

// Generate a response
const response = await agent.generate('Hello!');

// Stream a response
const stream = await agent.stream('Tell me a story');
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Models

<ProviderModelsTable
models={[
{
"model": "anthropic/claude-3-5-sonnet-20241022",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 8192,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-3-5-sonnet-20240620",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 8192,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-3-opus-20240229",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 4096,
"inputCost": 15,
"outputCost": 75
},
{
"model": "anthropic/claude-sonnet-4-5-20250929",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 64000,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-sonnet-4-20250514",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 64000,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-opus-4-20250514",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 32000,
"inputCost": 15,
"outputCost": 75
},
{
"model": "anthropic/claude-3-5-haiku-20241022",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 8192,
"inputCost": 0.8,
"outputCost": 4
},
{
"model": "anthropic/claude-3-haiku-20240307",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 4096,
"inputCost": 0.25,
"outputCost": 1.25
},
{
"model": "anthropic/claude-3-7-sonnet-20250219",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 64000,
"inputCost": 3,
"outputCost": 15
},
{
"model": "anthropic/claude-opus-4-1-20250805",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": true,
"contextWindow": 200000,
"maxOutput": 32000,
"inputCost": 15,
"outputCost": 75
},
{
"model": "anthropic/claude-3-sonnet-20240229",
"imageInput": true,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 200000,
"maxOutput": 4096,
"inputCost": 3,
"outputCost": 15
}
]}
/>

## Advanced Configuration

### Custom Headers

```typescript
const agent = new Agent({
  name: 'custom-agent',
  model: {
    modelId: 'claude-3-5-haiku-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY,
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
    return useAdvanced ? 'anthropic/claude-sonnet-4-5-20250929' : 'anthropic/claude-3-5-haiku-20241022';
  },
});
```

## Direct Provider Installation

This provider can also be installed directly as a standalone package, which can be used instead of the Mastra model router string. View the [package documentation](https://www.npmjs.com/package/@ai-sdk/anthropic) for more details.

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @ai-sdk/anthropic
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @ai-sdk/anthropic
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @ai-sdk/anthropic
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @ai-sdk/anthropic
    ```
  </TabItem>
</Tabs>
