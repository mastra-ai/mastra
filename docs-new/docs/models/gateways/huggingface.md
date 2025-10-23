---
title: 'Hugging Face '
description: 'Use AI models through Hugging Face.'
---

# <img src="https://models.dev/logos/huggingface.svg" alt="Hugging Face logo" className="inline w-8 h-8 mr-2 align-middle dark:invert dark:brightness-0 dark:contrast-200" />Hugging Face

Hugging Face aggregates models from multiple providers with enhanced features like rate limiting and failover. Access 11 models through Mastra's model router.

Learn more in the [Hugging Face documentation](https://huggingface.co).

## Usage

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful assistant',
  model: 'huggingface/Qwen/Qwen3-235B-A22B-Thinking-2507',
});
```

:::note OpenAI Compatibility

Mastra uses the OpenAI-compatible `/chat/completions` endpoint. Some provider-specific features may not be available. Check the [Hugging Face documentation](https://huggingface.co) for details.

:::

## Configuration

```bash
# Use gateway API key
HUGGINGFACE_API_KEY=your-gateway-key

# Or use provider API keys directly
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
```

## Available Models

| Model                                 |
| ------------------------------------- |
| `Qwen/Qwen3-235B-A22B-Thinking-2507`  |
| `Qwen/Qwen3-Coder-480B-A35B-Instruct` |
| `Qwen/Qwen3-Next-80B-A3B-Instruct`    |
| `Qwen/Qwen3-Next-80B-A3B-Thinking`    |
| `deepseek-ai/DeepSeek-R1-0528`        |
| `deepseek-ai/Deepseek-V3-0324`        |
| `moonshotai/Kimi-K2-Instruct`         |
| `moonshotai/Kimi-K2-Instruct-0905`    |
| `zai-org/GLM-4.5`                     |
| `zai-org/GLM-4.5-Air`                 |
| `zai-org/GLM-4.6`                     |
