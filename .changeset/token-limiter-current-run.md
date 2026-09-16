---
'@mastra/core': patch
---

Fixed `TokenLimiterProcessor` removing the current run's tool calls and results between agent loop steps. When a tool result made the run's response larger than the remaining token budget, the default `best-fit` mode dropped that whole response message, so the next model call no longer contained the tool call or its result, the model often called the same tool again until `maxSteps` ran out, and the result was never saved to memory.

Messages produced by the current run are now always kept and counted against the budget first, and only older messages are trimmed to fit. If the current run's messages alone exceed the budget, the processor throws a non-retryable `TripWire` instead of silently removing them, which matches what `trimMode: 'contiguous'` already did.
