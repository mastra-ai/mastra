---
'@mastra/inngest': patch
---

Fixed `InngestAgent.resume()` ignoring `hooks` passed at resume time. A resumed tool call now runs the `beforeToolCall` and `afterToolCall` hooks you pass to `resume()`. Delegation callbacks, toolsets, and memory tools from the original call are kept on resume. `InngestAgent.stream()` now accepts `hooks` in its options type.

Per-call hooks are functions and only live in the process that received the call. If a run resumes in a different process, only constructor hooks and `defaultOptions.hooks` run.
