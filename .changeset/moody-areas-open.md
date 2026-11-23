---
'@mastra/context': minor
---

Added `@mastra/context` tools for Context.dev web search and Markdown scraping. Set `CONTEXT_DEV_API_KEY` in your server environment and register the tools with an agent:

```typescript
import { Agent } from '@mastra/core/agent';
import { createContextTools } from '@mastra/context';

const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-6.1-sol',
  instructions: 'Search for primary sources, scrape their content, and cite their URLs.',
  tools: createContextTools(),
});
```
