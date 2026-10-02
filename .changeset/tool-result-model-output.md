---
'@mastra/core': patch
---

Rewritten tool results from `processToolResult` (for example a redacted secret) now reach the model, the display, and stored tool output:

- For client-executed tools in the default and durable agent loops, `toModelOutput` now runs after `processToolResult`, on the processed result. Before, it mapped the original value, so the model still saw it.
- For client-executed tools and deferred provider-executed results in the default loop, tool payload transforms now run after `processToolResult`, so the display and stored output use the processed result.

A provider-executed result that arrives in the same response as its call has no stored part of its own yet, so a processor still can't rewrite this turn's stored result.

When a provider reused a tool call id from an earlier turn (for example `call_0`) and an output processor with `processToolResult` was registered, the streamed `tool-result` chunk could show the earlier turn's result. It now shows this turn's result, or the value a processor wrote.
