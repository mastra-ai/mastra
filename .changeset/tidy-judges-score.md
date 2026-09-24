---
'@mastra/core': minor
---

Added `createClassifierScorer()` for using a configured `Classifier` as a typed Mastra scorer. Select one classifier question, get a score between 0 and 1, and retain the classifier evidence in the scorer result.

```typescript
import { Classifier } from '@mastra/core/classifier';
import { createClassifierScorer } from '@mastra/core/evals';
import { getAssistantMessageFromRunOutput } from '@mastra/evals/scorers/utils';

const classifier = new Classifier({
  id: 'response-quality',
  model,
  questions: {
    quality: {
      type: 'score',
      criteria: ['Incorrect', 'Partially correct', 'Correct'],
    },
  },
});

const scorer = createClassifierScorer({
  id: 'response-quality-scorer',
  classifier,
  question: 'quality',
  type: 'agent',
  state: ({ run }) => ({ output: getAssistantMessageFromRunOutput(run.output) ?? '' }),
});
```
