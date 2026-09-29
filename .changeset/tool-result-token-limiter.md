---
'@mastra/core': minor
---

Added `ToolResultTokenLimiter`, an output processor that truncates tool results over a token limit before they are stored or sent to the model. Truncated results end with a marker such as `[truncated: showing 2,000 of 18,400 tokens]`.

With `TokenLimiterProcessor`, set the per-result limit well below its budget so the current tool call and result fit in the prompt instead of being dropped, which made agents call the same tool again (#24110).

```typescript
import { Agent } from '@mastra/core/agent'
import { TokenLimiterProcessor, ToolResultTokenLimiter } from '@mastra/core/processors'

const agent = new Agent({
  // ...
  inputProcessors: [new TokenLimiterProcessor(8000)],
  outputProcessors: [new ToolResultTokenLimiter({ limit: 4000 })],
})
```
