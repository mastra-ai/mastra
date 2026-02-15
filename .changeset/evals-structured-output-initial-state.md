---
"@mastra/core": minor
---

Support structured output and workflow initial state in `runEvals`. Closes #12680.

- Add `structuredOutput` option for agents using AI SDK v5/v6 models, forwarded to `agent.generate()`.
- Add `output` option for agents using legacy AI SDK v4 models, forwarded to `agent.generateLegacy()`.
- Workflow initial state: Data items now accept an `initialState` field, forwarded to `run.start()` for workflow targets.

```ts
import { runEvals } from '@mastra/core/evals';
import { z } from 'zod';

// Structured output with v5+ models
await runEvals({
  target: myAgent,
  data: [{ input: 'Analyze this text', groundTruth: 'expected' }],
  scorers: [myScorer],
  structuredOutput: {
    schema: z.object({ answer: z.string(), confidence: z.number() }),
  },
});

// Legacy output schema with v4 models
await runEvals({
  target: legacyAgent,
  data: [{ input: 'Analyze this text', groundTruth: 'expected' }],
  scorers: [myScorer],
  output: z.object({ answer: z.string(), confidence: z.number() }),
});

// Workflow with initial state
await runEvals({
  target: myWorkflow,
  data: [
    {
      input: { query: 'test' },
      initialState: { counter: 0, label: 'init' },
      groundTruth: 'expected',
    },
  ],
  scorers: [myScorer],
});
```
