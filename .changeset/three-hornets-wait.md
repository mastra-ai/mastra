---
'@mastra/perplexity': minor
---

Added new `@mastra/perplexity` integration with the Perplexity Search tool for agents.

```ts
import { createPerplexityTools } from '@mastra/perplexity';

const { perplexitySearch } = createPerplexityTools({ apiKey: process.env.PERPLEXITY_API_KEY });
```
