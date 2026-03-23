---
'@mastra/memory': minor
'@mastra/playground-ui': patch
'@mastra/server': patch
---

Added `ModelByInputTokens` for Observational Memory so you can route observer and reflector model selection by input token count.

```ts
import { Memory, ModelByInputTokens } from '@mastra/memory'

const memory = new Memory({
  options: {
    observationalMemory: {
      model: new ModelByInputTokens({
        upTo: {
          5_000: 'openai/gpt-4o-mini',
          100_000: 'openai/gpt-4.1',
          1_000_000: 'google/gemini-2.5-flash',
        },
      }),
    },
  },
})
```

Improved Observational Memory tracing so traces show the observer and reflector spans and make it easier to see which resolved model was used at runtime.
