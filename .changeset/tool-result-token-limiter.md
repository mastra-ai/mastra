---
'@mastra/core': minor
---

Added `ToolResultTokenLimiter`, an output processor that truncates tool results over a token limit before they are stored or sent to the model.

```typescript
import { Agent } from '@mastra/core/agent'
import { ToolResultTokenLimiter } from '@mastra/core/processors'

const agent = new Agent({
  // ...
  outputProcessors: [new ToolResultTokenLimiter({ limit: 2000 })],
})
```
