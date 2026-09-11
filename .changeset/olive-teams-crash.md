---
'@mastra/core': minor
---

Added `notScorable()` for scorers. Return it from a scorer step when a run has nothing for that scorer to evaluate, for example a tool-call judge on a run that never called the tool. Remaining steps are skipped, so no judge model call is spent, no score is stored, and the run stays out of that scorer's averages. Existing scorers that never return `notScorable()` are unchanged. `scoreTrace()` returns `null` only for this outcome; `scoreTraceBatch()` reports it as `excludedCount` rather than scored or failed. Live scorer hooks, `runEvals` gates and turns, and experiments all honor it.

```ts
import { createScorer, notScorable } from '@mastra/core/evals';

const refundJudge = createScorer({ id: 'refund-judge', description: 'Judges refund handling' })
  .preprocess(({ run }) => (calledRefundTool(run) ? { ok: true } : notScorable('refundCustomer was not called')))
  .generateScore(({ results }) => (results.preprocessStepResult.ok ? 1 : 0));
```
