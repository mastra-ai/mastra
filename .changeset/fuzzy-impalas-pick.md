---
'@mastra/core': minor
---

Added `notScorable()` so a scorer can declare that a run has nothing to evaluate.

Return it from any function step (usually `preprocess`) and the remaining steps are skipped: no judge model call is made, no score is stored, and the run is left out of that scorer's averages, gates, and thresholds instead of dragging them down.

```ts
import { createScorer, notScorable } from '@mastra/core/evals'
import { extractToolCalls } from '@mastra/evals/scorers/utils'

const refundJudge = createScorer({
  id: 'refund-judge',
  type: 'agent',
  judge: { model: 'openai/gpt-5-mini', instructions: '...' },
})
  .preprocess(({ run }) => {
    const { tools } = extractToolCalls(run.output)
    return tools.includes('refundCustomer')
      ? { tools }
      : notScorable('refundCustomer was not called')
  })
  .generateScore({ createPrompt: ({ run }) => `Rate the refund handling: ${JSON.stringify(run.output)}` })

const result = await refundJudge.run(run)
if (result.notScorable) {
  // { step: 'preprocess', reason: 'refundCustomer was not called' }, no `score`
}
```

**What changes for each scoring path**

- Live scoring: no score row is stored; the outcome is recorded on the `SCORER_RUN` span and logged at debug level.
- `runEvals()`: not-scorable runs are excluded from `scores`, gate and threshold averages, and the verdict, and counted per scorer in `summary.notScorable`.
- Experiments: the scorer result carries `notScorable` alongside `score: null` and `error: null`.
- `scoreTrace()` resolves to `null`; `scoreTraceBatch()` reports `notScorableCount` separately from `scoredCount` and `failedCount`.

**Why**

Live scorers that only apply to some runs (for example, "was this refund handled well" when no refund tool was ever called) previously had to either spend a judge call and emit a meaningless score, or be paired with a separate scorer just to filter. Eligibility filters cover request-context conditions, but not conditions that depend on the run's own input or output. `notScorable()` fills that gap.

Scorers that never return `notScorable()` behave exactly as before.
