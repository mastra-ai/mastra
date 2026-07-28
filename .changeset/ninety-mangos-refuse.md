---
'@mastra/core': minor
---

Added a built-in web fetch tool export for agents to retrieve HTTP and HTTPS page content.

```ts
import { Agent } from '@mastra/core/agent';
import { webFetchTool } from '@mastra/core/tools';

export const agent = new Agent({
  name: 'Research agent',
  instructions: 'Use web_fetch when you need page content.',
  model,
  tools: { web_fetch: webFetchTool },
});
```
