---
'@mastra/core': patch
---

`TokenLimiterProcessor` could previously drop the current run's tool calls and results between agent steps, causing the model to never see tool output and call the same tool again until `maxSteps` ran out. Trimming (`processInputStep` / `processLLMRequest`) is now uniform across every message, with no special case for the current run — an oversized single result can still be trimmed away if the surrounding budget requires it.

Added an opt-in `maxToolResultTokens` setting that caps individual tool results instead of letting them be trimmed away entirely: it sends the model a truncated copy while keeping the full stored result intact. Capping runs through the `processToolResult` hook, so the processor must be registered in `outputProcessors` (in addition to `inputProcessors`, if used there) for `maxToolResultTokens` to take effect. Without this option set, oversized tool results remain ordinary trimmable content.

```typescript
const processor = new TokenLimiterProcessor({ limit: 8000, maxToolResultTokens: 2000 });

const agent = new Agent({
  // ...
  inputProcessors: [processor],
  outputProcessors: [processor],
});
```
