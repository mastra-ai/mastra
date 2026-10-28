---
"@mastra/core": patch
---

Use AI SDK v7 provider adapters for OpenAI, Anthropic, Google, Mistral, Perplexity, OpenRouter, compatible endpoints and gateways.

Perplexity now exposes its current Agent API models through both `perplexity` and `perplexity-agent`. Retired bare Sonar model IDs report an actionable error. Choose a current preset or direct model explicitly; presets can change the underlying model, tools, cost and latency.

```ts
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  instructions: 'Answer research questions with sources.',
  // Before: model: 'perplexity/sonar-reasoning-pro'
  model: 'perplexity/medium',
});
```

Existing Perplexity reasoning and search settings migrate where the Agent API has an equivalent. Image tool results remain available on follow-up turns. Unsupported result options and non-image file inputs report migration errors instead of being silently dropped. Explicit native options and custom proxy URLs are preserved.
