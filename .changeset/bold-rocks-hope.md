---
'@mastra/core': patch
'@mastra/react': patch
---

Remove redundant toolCalls from network agent finalResult

The network agent's `finalResult` was storing `toolCalls` separately even though all tool call information is already present in the `messages` array (as `tool-call` and `tool-result` type messages). This caused significant token waste since the routing agent reads this data from memory on every iteration.

**Before:** `finalResult: { text, toolCalls, messages }`
**After:** `finalResult: { text, messages }`

Updated `@mastra/react` to extract tool calls directly from the `messages` array instead of the removed `toolCalls` field when resolving initial messages from memory.

Fixes #11059
