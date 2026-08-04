---
'@mastra/core': minor
---

Added scorer failure results so callers can inspect completed stages and `status: 'failed'` judge executions in `error.result.judge` after `scorer.run()` rejects.

```typescript
import { ScorerRunError } from '@mastra/core/evals';

try {
  await scorer.run(input);
} catch (error) {
  if (error instanceof ScorerRunError) {
    console.log(error.failedStep);
    console.log(error.completedSteps);
    console.log(error.result);
  }
}
```
