---
'@mastra/evals': minor
---

Added context-recall LLM scorer that evaluates how well retrieved context covers the claims in a ground-truth reference answer. Complements the existing context-precision scorer by measuring retrieval completeness rather than relevance ranking.

```typescript
import { createContextRecallScorer } from '@mastra/evals/scorers/prebuilt'

const scorer = createContextRecallScorer({
  model: 'openai/gpt-5-mini',
  options: {
    context: [
      'Einstein was born on 14 March 1879 in Ulm, Germany.',
      'Einstein developed the theory of special relativity in 1905.',
    ],
  },
})
```
