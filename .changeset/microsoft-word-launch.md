---
'@mastra/connect': minor
---

Added a Microsoft Word toolset with 18 tools for drive discovery, document creation, copying, updating, deletion, moving, sharing, and export.

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const wordAgent = new Agent({
  id: 'word-agent',
  name: 'Word agent',
  instructions: 'Use the connected Microsoft Word tools to manage documents.',
  model: 'openai/gpt-5-mini',
  tools: tools({ providers: ['microsoft-word'] }),
});
```
