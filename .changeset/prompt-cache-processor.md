---
'@mastra/core': minor
---

Added `PromptCacheProcessor`, which adds Anthropic and Amazon Bedrock prompt-cache breakpoints to every model call. It marks the last system message and the last message, keeps breakpoints you already set and their TTL order, and never goes over the providers' limit of four. Other providers are left unchanged.

```ts
import { PromptCacheProcessor } from '@mastra/core/processors';

const agent = new Agent({
  model: 'anthropic/claude-sonnet-4-5',
  inputProcessors: [new PromptCacheProcessor({ ttl: '1h' })],
});
```

Refs #30514
