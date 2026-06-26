---
'@mastra/client-js': patch
'@mastra/core': patch
---

Preserve original tool-call arguments when a tool result is persisted without its matching tool-call in the same message. Previously the arguments were saved as empty `{}`, which poisoned the model's context and caused it to emit invalid empty-argument tool calls after a few cycles. The adapter now recovers the original arguments from prior persisted messages, covering the server resume path, AG-UI hosts replaying client-tool results, and `@mastra/client-js` streaming recursion.

Also execute every streamed client tool call emitted in the same tool-calls step before continuing, instead of only continuing with one tool result. Fixes #16017 and #15576.
