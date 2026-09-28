---
'@mastra/core': minor
---

Added `ToolResultTokenLimiter`, an output processor that truncates each tool result to a token limit, so later model calls see the truncated result. Register it with `TokenLimiter` so one oversized tool result can no longer push the current run's tool call and result out of the prompt, which left the agent without the data and calling the same tool again.

```ts
new Agent({
  inputProcessors: [new TokenLimiter(8000)],
  outputProcessors: [new ToolResultTokenLimiter(2000)],
});
```
