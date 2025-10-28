---
title: "Morph "
description: "Use Morph models with Mastra. 3 models available."
---

# <img src="https://models.dev/logos/morph.svg" alt="Morph logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Morph

Access 3 Morph models through Mastra's model router. Authentication is handled automatically using the `MORPH_API_KEY` environment variable.

Learn more in the [Morph documentation](https://docs.morphllm.com).

```bash
MORPH_API_KEY=your-api-key
```

```typescript
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "morph/auto",
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

Mastra uses the OpenAI-compatible `/chat/completions` endpoint. Some provider-specific features may not be available. Check the [Morph documentation](https://docs.morphllm.com) for details.

:::

## Models

<ProviderModelsTable
models={[
{
"model": "morph/morph-v3-large",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 32000,
"maxOutput": 32000,
"inputCost": 0.9,
"outputCost": 1.9
},
{
"model": "morph/auto",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 32000,
"maxOutput": 32000,
"inputCost": 0.85,
"outputCost": 1.55
},
{
"model": "morph/morph-v3-fast",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": false,
"reasoning": false,
"contextWindow": 16000,
"maxOutput": 16000,
"inputCost": 0.8,
"outputCost": 1.2
}
]}
/>

## Advanced Configuration

### Custom Headers

```typescript
const agent = new Agent({
  name: "custom-agent",
  model: {
    url: "https://api.morphllm.com/v1",
    modelId: "auto",
    apiKey: process.env.MORPH_API_KEY,
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
    return useAdvanced ? "morph/morph-v3-large" : "morph/auto";
  },
});
```
