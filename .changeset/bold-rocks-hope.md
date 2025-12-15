---
'@mastra/core': patch
---

Remove redundant toolCalls from network agent finalResult

The network agent's `finalResult` was storing `toolCalls` separately even though all tool call information is already present in the `messages` array (as `tool-call` and `tool-result` type messages). This caused significant token waste since the routing agent reads this data from memory on every iteration.

**Before:** `finalResult: { text, toolCalls, messages }`
**After:** `finalResult: { text, messages }`

Fixes #11059
