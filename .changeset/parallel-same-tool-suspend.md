---
'@mastra/core': patch
---

Fixed parallel suspends of the same tool overwriting each other's bookkeeping. When an LLM emitted two `tool_use` blocks for the same tool in one assistant turn and both suspended, the second entry replaced the first in `metadata.suspendedTools` / `metadata.pendingToolApprovals` and only one of the two calls could be resumed.

`addToolMetadata` now keys those records by `toolCallId` instead of `toolName`, so each parallel suspend remains a distinct entry. Readers iterate `Object.values()`, so older runs that persisted entries keyed by `toolName` continue to resolve through a backward-compat fallback. The AIV5 adapter renders one `data-tool-call-suspended` (or `data-tool-call-approval`) part per call, and `removeToolMetadata` clears only the matching `toolCallId` so parallel siblings keep their `resumed: false` flag.

Fixes #16468.
