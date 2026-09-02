---
'@mastra/core': minor
---

Added `notScorable()` for scorers. Return it from any scorer step when a run has nothing for that scorer to evaluate, for example a tool-call judge on a run that never called the tool. The remaining steps are skipped, so no judge model call is spent, no score is stored, and the run stays out of that scorer's averages instead of counting as a pass. Live scorer hooks, `scoreTraces` batches (which now report an `excludedCount`), `runEvals` gates and turns, and experiments all honor it.

```ts
import { createScorer, notScorable } from '@mastra/core/evals';

const refundJudge = createScorer({ id: 'refund-judge', description: 'Judges refund handling' })
  .preprocess(({ run }) => (calledRefundTool(run) ? { ok: true } : notScorable('refundCustomer was not called')))
  .generateScore(({ results }) => (results.preprocessStepResult.ok ? 1 : 0));
```
