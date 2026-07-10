---
'@mastra/core': minor
---

Added support for custom processors on `createScorer` judges. You can now pass `inputProcessors`, `outputProcessors`, `errorProcessors`, and `maxProcessorRetries` in a scorer's `judge` config (or per-step judge config) to apply processors to the internal judge agent — for example wiring up `StreamErrorRetryProcessor` to retry transient LLM errors while scoring.

```typescript
import { createScorer } from '@mastra/core/evals';
import { StreamErrorRetryProcessor } from '@mastra/core/processors';

const scorer = createScorer({
  id: 'my-scorer',
  description: 'Scores responses',
  judge: {
    model: myModel,
    instructions: 'You are an expert evaluator...',
    errorProcessors: [new StreamErrorRetryProcessor()],
    maxProcessorRetries: 3,
  },
});
```
