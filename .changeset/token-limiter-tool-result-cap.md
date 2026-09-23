---
'@mastra/core': patch
---

Fixed agents looping without ever seeing their tool results when `TokenLimiterProcessor` was configured. A large tool result could exceed the conversation budget, so the step-level trim evicted the tool call/result pair the model was waiting on, and the model called the same tool again on the next step.

Processors registered as `inputProcessors` now also run their `processToolResult` hook, which previously fired only for `outputProcessors`. A processor registered on both phases still runs exactly once per tool result.

`TokenLimiterProcessor` accepts a new `maxToolResultTokens` option that caps a single tool result. It is unset by default, so tool results pass through untouched. When set, an oversized result is truncated in place with a visible `[truncated: showing X of Y tokens]` marker before it reaches history or the next LLM call.
