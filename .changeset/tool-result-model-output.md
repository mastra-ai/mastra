---
'@mastra/core': patch
---

Fixed `processToolResult` rewrites not reaching everything derived from a tool result. When a processor rewrote a result (for example to redact a secret), a tool's `toModelOutput` mapping still sent the original value to the model, and tool payload transforms still stored and displayed the original value. Both now use the rewritten result, in the default and durable agent loops. A provider-executed result that arrives in the same response as its call still can't be rewritten by a processor.
