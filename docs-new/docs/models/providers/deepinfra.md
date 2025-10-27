---
title: "Deep Infra "
description: "Use Deep Infra models with Mastra. 4 models available."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# <img src="https://models.dev/logos/deepinfra.svg" alt="Deep Infra logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Deep Infra

Access 4 Deep Infra models through Mastra's model router. Authentication is handled automatically using the `DEEPINFRA_API_KEY` environment variable.

Learn more in the [Deep Infra documentation](https://deepinfra.com/models).

```bash
DEEPINFRA_API_KEY=your-api-key
```

```typescript
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct",
});

// Generate a response
const response = await agent.generate("Hello!");

// Stream a response
const stream = await agent.stream("Tell me a story");
for await (const chunk of stream) {
  console.log(chunk);
}
```

:::note OpenAI Compatibility

Mastra uses the OpenAI-compatible `/chat/completions` endpoint. Some provider-specific features may not be available. Check the [Deep Infra documentation](https://deepinfra.com/models) for details.

:::

## Models

<ProviderModelsTable
models={[
{
"model": "deepinfra/moonshotai/Kimi-K2-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 32768,
"inputCost": 0.5,
"outputCost": 2
},
{
"model": "deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 66536,
"inputCost": 0.4,
"outputCost": 1.6
},
{
"model": "deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 66536,
"inputCost": 0.3,
"outputCost": 1.2
},
{
"model": "deepinfra/zai-org/GLM-4.5",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 98304,
"inputCost": 0.6,
"outputCost": 2.2
}
]}
/>

## Advanced Configuration

### Custom Headers

```typescript
const agent = new Agent({
  name: "custom-agent",
  model: {
    url: "https://api.deepinfra.com/v1/openai",
    modelId: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    apiKey: process.env.DEEPINFRA_API_KEY,
    headers: {
      "X-Custom-Header": "value",
    },
  },
});
```

### Dynamic Model Selection

```typescript
const agent = new Agent({
  name: "dynamic-agent",
  model: ({ runtimeContext }) => {
    const useAdvanced = runtimeContext.task === "complex";
    return useAdvanced
      ? "deepinfra/zai-org/GLM-4.5"
      : "deepinfra/Qwen/Qwen3-Coder-480B-A35B-Instruct";
  },
});
```

## Direct Provider Installation

This provider can also be installed directly as a standalone package, which can be used instead of the Mastra model router string. View the [package documentation](https://www.npmjs.com/package/@ai-sdk/deepinfra) for more details.

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @ai-sdk/deepinfra
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @ai-sdk/deepinfra
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @ai-sdk/deepinfra
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @ai-sdk/deepinfra
    ```
  </TabItem>
</Tabs>
