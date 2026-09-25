---
'@mastra/core': patch
---

Fixed `TokenLimiterProcessor` dropping the current run's tool calls and results between agent steps, causing the model to never see tool output and call the same tool again until `maxSteps` ran out.

Added an optional `maxToolResultTokens` setting that caps individual tool results, sending the model a truncated copy while keeping the stored result intact. Capping runs through the `processToolResult` hook, so the processor must be registered in `outputProcessors` (in addition to `inputProcessors`, if used there) for `maxToolResultTokens` to take effect:

```typescript
const processor = new TokenLimiterProcessor({ limit: 8000, maxToolResultTokens: 2000 });

const agent = new Agent({
  // ...
  inputProcessors: [processor],
  outputProcessors: [processor],
});
```
