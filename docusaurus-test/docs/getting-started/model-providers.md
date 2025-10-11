---
title: "Model Providers "
description: "Learn how to configure and use different model providers with Mastra."
---

# Model Providers

Mastra's unified model router gives you access to 541+ models from 38 providers with a single API. Switch between models and providers without changing your code. Automatic environment variable detection handles authentication, while TypeScript provides full autocomplete for every model.

## Quick Start

Simply use the `provider/model` string pattern:

```typescript showLineNumbers copy filename="src/mastra/agents/weather-agent.ts"
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "WeatherAgent",
  instructions: "You are a helpful weather assistant",
  model: "openai/gpt-4o"
});

const result = await agent.generate("What is the weather like?");
```

## Browse Providers

:::note

  **[→ View all 38 providers and 7 gateways](../../models)**

  Explore our complete catalog with logos, model counts, and documentation for each provider.

:::

## Configuration

Models automatically detect API keys from environment variables.

## AI SDK Compatibility

While Mastra provides built-in support for 541+ models, you can also use [Vercel AI SDK](https://sdk.vercel.ai/providers/ai-sdk-providers) model providers for additional flexibility:

```typescript
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "AISDKAgent",
  model: openai("gpt-4-turbo")  // AI SDK model provider
});
```

:::info

**Recommendation**: Use Mastra's built-in model router (`"provider/model"` strings) for simplicity. Use AI SDK providers only when you need specific features not available in the built-in providers.

:::

## Learn More

- [Browse All Model Providers](../../models) - Complete list with examples
- [Agent Documentation](../../reference/agents/agent.md) - Using models with agents
- [Environment Variables](../getting-started/installation.mdx#add-your-api-key) - Configuration guide
- [Tool Configuration](../agents/using-tools-and-mcp.mdx#adding-tools-to-an-agent) - Adding tools to agents
