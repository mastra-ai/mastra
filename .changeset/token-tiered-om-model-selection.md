---
'@mastra/core': minor
'@mastra/memory': minor
---

Added `ModelByInputTokens` helper for token-threshold-based model selection in Observational Memory.

When configured, OM automatically selects a cheaper model for small inputs and a stronger model for large inputs based on the actual token count of the content being processed by the Observer or Reflector.

Example usage:

```ts
import { Memory } from '@mastra/memory'
import { ModelByInputTokens } from '@mastra/core/llm'

const memory = new Memory({
  options: {
    observationalMemory: {
      model: new ModelByInputTokens({
        upTo: {
          10_000: 'google/gemini-2.5-flash',   // Fast for small inputs
          40_000: 'openai/gpt-4o',             // Stronger for medium inputs
          1_000_000: 'openai/gpt-4.5',          // Most capable for large inputs
        },
      }),
    },
  },
})
```

The `upTo` keys are inclusive upper bounds. OM sets the input token count in the request context automatically before resolving the model. If the input exceeds the largest configured threshold, an error is thrown.

**Breaking change:** Observation and reflection failures now propagate as errors instead of being silently swallowed. Previously, if observation failed (e.g., due to ModelByInputTokens misconfiguration), OM would log the error and continue. Now, such failures will throw and crash the agent, ensuring configuration issues are caught early.
