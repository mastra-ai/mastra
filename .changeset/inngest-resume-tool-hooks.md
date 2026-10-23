---
'@mastra/inngest': patch
---

Fixed `InngestAgent.resume()` ignoring `hooks` passed at resume time. A resumed tool call now runs the `beforeToolCall` and `afterToolCall` hooks you pass to `resume()`, instead of the hooks from the original call.
