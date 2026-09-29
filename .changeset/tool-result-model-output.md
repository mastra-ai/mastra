---
'@mastra/core': patch
---

Rewritten tool results from `processToolResult` (for example a redacted secret) now reach the model, the display, and stored tool output. Before, a tool's `toModelOutput` mapping still sent the original value to the model, and tool payload transforms still stored and displayed it. For client-executed tools in both the default and durable agent loops, and for deferred provider-executed results in the default loop, `toModelOutput` and payload transforms now run once, after `processToolResult`, on the processed result.

A provider-executed result that arrives in the same response as its call still can't be rewritten by a processor.

When a provider reused a tool call id from an earlier turn (for example `call_0`) and an output processor with `processToolResult` was registered, the streamed `tool-result` chunk could show the earlier turn's result. It now shows this turn's result.
