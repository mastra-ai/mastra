---
'@mastra/core': minor
---

Added support for AI SDK v7 models (`LanguageModelV4`). You can now pass any AI SDK v7 provider model directly to an agent, alongside the existing AI SDK v4, v5, and v6 support.

```ts
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai'; // AI SDK v7

const agent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful assistant.',
  model: openai('gpt-5'),
});
```

Mastra detects the model's specification version automatically, so mixing models from different AI SDK versions across your agents continues to work without any extra configuration.
