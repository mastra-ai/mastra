---
title: "Netlify "
description: "Use AI models through Netlify."
---

# <NetlifyLogo className="inline w-8 h-8 mr-2 align-middle" />Netlify

Netlify AI Gateway provides unified access to multiple providers with built-in caching and observability. Access 33 models through Mastra's model router.

Learn more in the [Netlify documentation](https://docs.netlify.com/build/ai-gateway/overview/).

## Usage

```typescript
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: "netlify/anthropic/claude-opus-4-20250514",
});
```

:::note OpenAI Compatibility

Mastra uses the OpenAI-compatible `/chat/completions` endpoint. Some provider-specific features may not be available. Check the [Netlify documentation](https://docs.netlify.com/build/ai-gateway/overview/) for details.

:::

## Configuration

```bash
# Use gateway API key
NETLIFY_API_KEY=your-gateway-key

# Or use provider API keys directly
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
```

## Available Models

| Model                                          |
| ---------------------------------------------- |
| `anthropic/claude-opus-4-20250514`             |
| `anthropic/claude-3-7-sonnet-20250219`         |
| `anthropic/claude-3-7-sonnet-latest`           |
| `anthropic/claude-3-haiku-20240307`            |
| `anthropic/claude-opus-4-1-20250805`           |
| `anthropic/claude-sonnet-4-5-20250929`         |
| `anthropic/claude-sonnet-4-20250514`           |
| `anthropic/claude-3-5-haiku-20241022`          |
| `anthropic/claude-3-5-haiku-latest`            |
| `gemini/gemini-2.0-flash-lite`                 |
| `gemini/gemini-2.5-flash-image-preview`        |
| `gemini/gemini-2.5-pro`                        |
| `gemini/gemini-flash-latest`                   |
| `gemini/gemini-2.5-flash-preview-09-2025`      |
| `gemini/gemini-flash-lite-latest`              |
| `gemini/gemini-2.5-flash`                      |
| `gemini/gemini-2.5-flash-lite-preview-09-2025` |
| `gemini/gemini-2.5-flash-lite`                 |
| `gemini/gemini-2.0-flash`                      |
| `openai/gpt-4o`                                |
| `openai/gpt-4o-mini`                           |
| `openai/o4-mini`                               |
| `openai/o3`                                    |
| `openai/gpt-5-pro`                             |
| `openai/gpt-5`                                 |
| `openai/gpt-5-codex`                           |
| `openai/gpt-5-mini`                            |
| `openai/gpt-5-nano`                            |
| `openai/gpt-4.1`                               |
| `openai/o3-mini`                               |
| `openai/codex-mini-latest`                     |
| `openai/gpt-4.1-mini`                          |
| `openai/gpt-4.1-nano`                          |
