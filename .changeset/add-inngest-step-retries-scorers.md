---
'@mastra/inngest': patch
---

Add support for `retries` and `scorers` parameters in `createStep` for InngestWorkflow

The `createStep` function now properly preserves the `retries` and `scorers` fields when creating workflow steps, enabling step-level retry configuration and AI evaluation support.

```typescript
import { init } from '@mastra/inngest';
import { z } from 'zod';

const { createStep } = init(inngest);

// Create a step with retry configuration
const resilientStep = createStep({
  id: 'api-call',
  inputSchema: z.object({ url: z.string() }),
  outputSchema: z.object({ data: z.any() }),
  retries: 3, // ← Will retry up to 3 times on failure
  execute: async ({ inputData }) => {
    const response = await fetch(inputData.url);
    return { data: await response.json() };
  },
});

// Create a step with scorers for AI evaluation
const evaluatedStep = createStep({
  id: 'evaluated-step',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
  scorers: myScorers, // ← Attach evaluation functions
  execute: async ({ inputData }) => {
    return { output: inputData.input };
  },
});
```

This is a non-breaking change - steps without these parameters continue to work exactly as before.

Fixes #9351
