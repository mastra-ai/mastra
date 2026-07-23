---
'@mastra/client-js': patch
'@mastra/core': patch
---

Preserve client-tool call args when a tool-result is replayed without its call

On the client-tool recursion path, the tool-result is sent back as a standalone `role: "tool"` message, so when the conversation is rebuilt the originating tool-call is not in the same converted window. `findToolCallArgs` only recovers args when the call is present in `dbMessages`; on this path it isn't reachable, so the reconstructed tool-call fell back to `args: {}`. Once that empty-args call is persisted, the model in-context-learns the pattern and loops, re-emitting empty-args tool calls (issue #16017).

`@mastra/client-js` now attaches the original args directly to the tool-result (under both `args` and `input`), and `AIV5Adapter` honors args carried on the tool-result before falling back to `input` and then `{}`, treating an empty object as absent. This keeps the original args intact across persistence and replay even when the originating call isn't in scope.
