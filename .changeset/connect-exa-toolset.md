---
'@mastra/connect': minor
---

Added an Exa toolset with 3 tools. Agents can search the web, optionally with each result's text, highlights, or summary; read the contents of pages by URL; and answer questions with cited sources.

```typescript
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research agent',
  instructions: 'You research questions on the web and cite your sources.',
  model: 'openai/gpt-6-luna',
  tools: tools({ providers: ['exa'] }),
});
```
