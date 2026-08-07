---
'@mastra/core': patch
---

Fixed tool calls that fail during execution staying stuck as running in agent-controller session streams. A tool error now updates the streamed message part to a terminal errored result and emits the corresponding message update, exactly like a successful tool result. The `isError` flag on persisted tool invocations is now part of the public type instead of an undeclared runtime field.
