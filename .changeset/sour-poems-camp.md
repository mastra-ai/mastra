---
'@mastra/brightdata': minor
---

Added `@mastra/brightdata` integration with `brightdata-search` and `brightdata-fetch` tools backed by Bright Data's SERP API and Web Unlocker. The tools bypass bot detection and CAPTCHAs out of the box.

```typescript
import { Agent } from '@mastra/core/agent';
import { createBrightDataTools } from '@mastra/brightdata';

const agent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions: 'Use brightdata-search to find pages and brightdata-fetch to read them.',
  tools: createBrightDataTools(),
});
```

Set `BRIGHTDATA_API_TOKEN` in your environment, or pass `{ apiKey }` explicitly.
