---
'@mastra/core': minor
---

Added `notScorable()`. Return it from a scorer step when a run has nothing to evaluate, for example a refund judge on a chat that never called the refund tool. Remaining steps are skipped, so the judge is never called and the run stays out of that scorer's averages.

```ts
import { createScorer, notScorable } from '@mastra/core/evals'
import { extractToolCalls } from '@mastra/evals/scorers/utils'

const refundJudge = createScorer({
  id: 'refund-judge',
  description: 'Judges refund handling',
  type: 'agent',
  judge: { model: 'openai/gpt-5-mini', instructions: '...' },
})
  .preprocess(({ run }) => {
    const { tools } = extractToolCalls(run.output)
    return tools.includes('refundCustomer')
      ? { tools }
      : notScorable('refundCustomer was not called')
  })
  .generateScore({
    description: 'Score the refund handling from 0 to 1',
    createPrompt: ({ run }) => `Rate the refund handling: ${JSON.stringify(run.output)}`,
  })
```

**Reading the result.** `scorer.run()` is either scored or skipped. Check `notScorable` before using `score` as a number, including on scorers that never skip:

```ts
const result = await refundJudge.run(input)
if (result.notScorable) {
  // skipped — no score
} else {
  result.score
}
```
