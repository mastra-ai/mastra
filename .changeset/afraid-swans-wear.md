---
'@mastra/evals': minor
---

Added `createRubricScorer`, an LLM-as-judge scorer that grades agent output against a rubric of criteria and returns a binary verdict (1 only when every required criterion is satisfied) with per-criterion feedback. Drop it into `isTaskComplete` to make an agent self-correct until the rubric is met.

```typescript
import { createRubricScorer } from '@mastra/evals/scorers/prebuilt';

const rubricScorer = createRubricScorer({
  model: '__GATEWAY_OPENAI_MODEL_MINI__',
  criteria: [
    { description: 'The response includes an analysis section' },
    { description: 'The response includes concrete recommendations' },
  ],
});

await supervisor.stream('Research AI in education', {
  maxSteps: 10,
  isTaskComplete: { scorers: [rubricScorer], strategy: 'all' },
});
```

The rubric accepts a criteria array or a newline-delimited string, supports optional (non-gating) criteria, and can be supplied per run via request context under a `rubric` key.
