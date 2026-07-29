---
'@mastra/core': minor
---

Added a built-in web search tool that resolves to provider-native search for supported models.

```ts
import { Agent } from '@mastra/core/agent';
import { webSearchTool } from '@mastra/core/tools';

export const agent = new Agent({
  name: 'web-search-agent',
  instructions: 'Use web search for current information.',
  model: 'openai/gpt-5-mini',
  tools: { webSearch: webSearchTool },
});
```
