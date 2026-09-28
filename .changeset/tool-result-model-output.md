---
'@mastra/core': patch
---

Rewritten tool results from `processToolResult` (for example a redacted secret) now reach the model, the display, and stored tool output. Before, a tool's `toModelOutput` mapping still sent the original value to the model, and tool payload transforms still stored and displayed it. `toModelOutput` now maps the rewritten result in both the default and durable agent loops, and the default loop now recomputes payload transforms from it (the durable loop already did).

A provider-executed result that arrives in the same response as its call still can't be rewritten by a processor.
