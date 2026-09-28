---
'@mastra/core': patch
---

Fixed tools with `toModelOutput` ignoring `processToolResult` rewrites. When a processor rewrote a tool result (for example to redact a secret), the model still received the mapping of the original result. The mapping now runs on the rewritten result, in both the default and durable agent loops.
