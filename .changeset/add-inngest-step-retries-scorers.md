---
'@mastra/inngest': patch
---

Add support for `retries` and `scorers` parameters across all `createStep` overloads for InngestWorkflow

The `createStep` function now includes support for the `retries` and `scorers` fields across all step creation patterns, enabling step-level retry configuration and AI evaluation support for regular steps, agent-based steps, and tool-based steps.

```typescript
import { init } from '@mastra/inngest';
import { z } from 'zod';

const { createStep } = init(inngest);

// 1. Regular step with retries
const regularStep = createStep({
  id: 'api-call',
  inputSchema: z.object({ url: z.string() }),
  outputSchema: z.object({ data: z.any() }),
  retries: 3, // ← Will retry up to 3 times on failure
  execute: async ({ inputData }) => {
    const response = await fetch(inputData.url);
    return { data: await response.json() };
  },
});

// 2. Agent step with retries and scorers
const agentStep = createStep(myAgent, {
  retries: 3,
  scorers: [
    { id: 'accuracy-scorer', scorer: myAccuracyScorer }
  ],
});

// 3. Tool step with retries and scorers
const toolStep = createStep(myTool, {
  retries: 2,
  scorers: [
    { id: 'quality-scorer', scorer: myQualityScorer }
  ],
});
```

This change ensures API consistency across all `createStep` overloads. All step types now support retry and evaluation configurations.

This is a non-breaking change - steps without these parameters continue to work exactly as before.

Fixes #9351
