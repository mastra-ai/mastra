---
'@mastra/core': minor
'@mastra/memory': minor
---

Added `ModelByInputTokens` in `@mastra/memory` for token-threshold-based model selection in Observational Memory.

When configured, OM automatically selects different observer or reflector models based on the actual input token count at the time the OM call runs.

Example usage:

```ts
import { Memory, ModelByInputTokens } from '@mastra/memory'

const memory = new Memory({
  options: {
    observationalMemory: {
      model: new ModelByInputTokens({
        upTo: {
          10_000: 'google/gemini-2.5-flash',
          40_000: 'openai/gpt-4o',
          1_000_000: 'openai/gpt-4.5',
        },
      }),
    },
  },
})
```

The `upTo` keys are inclusive upper bounds. OM resolves the matching tier directly at the observer or reflector call site. If the input exceeds the largest configured threshold, OM throws an error.
