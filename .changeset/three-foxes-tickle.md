---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
---

Added Trace Intelligence progress types and improved the onboarding state with processing progress, clearer copy, accessible markup, mobile polish, and the dedicated documentation link.

```ts
import type { EntityLearningProgressResponse } from '@mastra/client-js';

const progress: EntityLearningProgressResponse = {
  status: 'processing',
  traceCount: 87,
  signals: {
    goal: { generated: 87, embedded: 84 },
    outcome: { generated: 87, embedded: 40 },
    behavior: { generated: 52, embedded: 12 },
    sentiment: { generated: 0, embedded: 0 },
  },
  availableSignals: ['goal'],
};
```
