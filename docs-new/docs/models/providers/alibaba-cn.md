---
title: "Alibaba (China) "
description: "Use Alibaba (China) models with Mastra. 1 model available."
---

# <img src="https://models.dev/logos/alibaba-cn.svg" alt="Alibaba (China) logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Alibaba (China)

Access 1 Alibaba (China) model through Mastra's model router. Authentication is handled automatically using the `DASHSCOPE_API_KEY` environment variable.

Learn more in the [Alibaba (China) documentation](https://www.alibabacloud.com/help/en/model-studio/models).

```bash
DASHSCOPE_API_KEY=your-api-key
```

```typescript
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "alibaba-cn/qwen3-coder-plus",
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

Mastra uses the OpenAI-compatible `/chat/completions` endpoint. Some provider-specific features may not be available. Check the [Alibaba (China) documentation](https://www.alibabacloud.com/help/en/model-studio/models) for details.

:::

## Models

<ProviderModelsTable
models={[
{
"model": "alibaba-cn/qwen3-coder-plus",
"imageInput": false,
"audioInput": false,
"videoInput": false,
"toolUsage": true,
"reasoning": false,
"contextWindow": 1048576,
"maxOutput": 65536,
"inputCost": 1,
"outputCost": 5
}
]}
/>

## Advanced Configuration

### Custom Headers

```typescript
const agent = new Agent({
  name: "custom-agent",
  model: {
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelId: "qwen3-coder-plus",
    apiKey: process.env.DASHSCOPE_API_KEY,
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
      ? "alibaba-cn/qwen3-coder-plus"
      : "alibaba-cn/qwen3-coder-plus";
  },
});
```
