---
title: "Moonshot AI (China) "
description: "Use Moonshot AI (China) models with Mastra. 3 models available."
---

# <img src="https://models.dev/logos/moonshotai-cn.svg" alt="Moonshot AI (China) logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Moonshot AI (China)

Access 3 Moonshot AI (China) models through Mastra's model router. Authentication is handled automatically using the `MOONSHOT_API_KEY` environment variable.

Learn more in the [Moonshot AI (China) documentation](https://platform.moonshot.cn).

```bash
MOONSHOT_API_KEY=your-api-key
```

```typescript
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "moonshotai-cn/kimi-k2-0711-preview",
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

Mastra uses the OpenAI-compatible `/chat/completions` endpoint. Some provider-specific features may not be available. Check the [Moonshot AI (China) documentation](https://platform.moonshot.cn) for details.

:::

## Models

<ProviderModelsTable
models={[
{
"model": "moonshotai-cn/kimi-k2-0905-preview",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 262144,
"inputCost": 0.6,
"outputCost": 2.5
},
{
"model": "moonshotai-cn/kimi-k2-0711-preview",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 131072,
"maxOutput": 16384,
"inputCost": 0.6,
"outputCost": 2.5
},
{
"model": "moonshotai-cn/kimi-k2-turbo-preview",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 262144,
"maxOutput": 262144,
"inputCost": 2.4,
"outputCost": 10
}
]}
/>

## Advanced Configuration

### Custom Headers

```typescript
const agent = new Agent({
  name: "custom-agent",
  model: {
    url: "https://api.moonshot.cn/v1",
    modelId: "kimi-k2-0711-preview",
    apiKey: process.env.MOONSHOT_API_KEY,
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
      ? "moonshotai-cn/kimi-k2-turbo-preview"
      : "moonshotai-cn/kimi-k2-0711-preview";
  },
});
```
