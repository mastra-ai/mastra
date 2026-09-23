---
'@mastra/core': minor
---

Added `createClassifierScorer()` for using a configured `Classifier` as a typed Mastra scorer. Select one classifier question, map choice answers to numeric scores when needed, and retain the classifier evidence in the scorer result.

```typescript
import { Classifier } from '@mastra/core/classifier';
import { createClassifierScorer } from '@mastra/core/evals';

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
});
```
