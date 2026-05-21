---
'@mastra/core': minor
---

Added `AdaptiveModelRouter`, a processor that drives model fallback and observability-based model switching for v2/v3 agents.

Legacy `model: [...]` fallback arrays are now automatically routed through the router (reactive fallback only — no observability rules are auto-configured). For observability-driven routing (error-rate, score, or feedback rules), wire the router explicitly as an input + error processor.

```ts
import { Agent } from '@mastra/core/agent';
import { AdaptiveModelRouter } from '@mastra/core/processors';

const router = new AdaptiveModelRouter({
  models: [
    { id: 'primary', model: openai('gpt-4o') },
    { id: 'fallback', model: anthropic('claude-3-5-sonnet') },
  ],
  scope: 'resource',
  rules: [
    { signal: 'error-rate', threshold: 0.3, minRequests: 5, window: '1h', cooldown: '5m' },
    { signal: 'score', scorerId: 'helpfulness', minScore: 0.7, window: '24h' },
  ],
});

const agent = new Agent({
  name: 'support',
  instructions: '...',
  model: openai('gpt-4o'),
  inputProcessors: [router],
  errorProcessors: [router],
});
```
