---
'@mastra/core': minor
---

Added `notScorable()`. Return it from a scorer step when a run has nothing to evaluate, for example a refund judge on a chat that never called the refund tool. Remaining steps are skipped, so the judge is never called and the run stays out of that scorer's averages.

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
```
