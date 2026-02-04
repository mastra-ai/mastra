---
'@mastra/evals': minor
---

Added `getContext` hook to hallucination scorer for dynamic context resolution at runtime. This enables live scoring scenarios where context (like tool results) is only available when the scorer runs. Also added `extractToolResults` utility function to help extract tool results from scorer output.

**Before (static context):**

```typescript
const scorer = createHallucinationScorer({
  model: openai('gpt-4o'),
  options: {
    context: ['The capital of France is Paris.', 'France is in Europe.'],
  },
});
```

**After (dynamic context from tool results):**

```typescript
import { extractToolResults } from '@mastra/evals/scorers';

const scorer = createHallucinationScorer({
  model: openai('gpt-4o'),
  options: {
    getContext: ({ run }) => {
      const toolResults = extractToolResults(run.output);
      return toolResults.map(t => JSON.stringify({ tool: t.toolName, result: t.result }));
    },
  },
});
```
