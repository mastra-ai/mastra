---
'@mastra/core': minor
---

Added `ToolResultTokenLimiter`, an output processor that caps how many tokens of each tool result the model reads. The stored and streamed result stays whole; only the copy sent to the model is truncated, ending with a marker such as `[truncated: showing 2,000 of 18,400 tokens]`.

With `TokenLimiterProcessor`, set the per-result limit well below its budget so the current tool call and result fit in the prompt instead of being dropped, which made agents call the same tool again (#24110).

```typescript
import { Agent } from '@mastra/core/agent';
import { TokenLimiterProcessor, ToolResultTokenLimiter } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  inputProcessors: [new TokenLimiterProcessor({ limit: 8000 })],
  outputProcessors: [new ToolResultTokenLimiter({ limit: 4000 })],
});
```

Added the `processToolModelOutput` processor hook. It runs once per tool result, after `processToolResult` and `toModelOutput`, and changes only what the model reads. `processToolResult` still changes the result itself.

`TokenLimiterProcessor` now counts the `toModelOutput` copy of a tool result when one exists, since that is what the model reads.
