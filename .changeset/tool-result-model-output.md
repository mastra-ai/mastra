---
'@mastra/core': patch
---

Rewritten tool results from `processToolResult` (for example a redacted secret) now reach the model, the display, and stored tool output. Before, a tool's `toModelOutput` mapping still sent the original value to the model, and tool payload transforms still stored and displayed it. For client-executed tools, `toModelOutput` now maps the rewritten result in both the default and durable agent loops. The default loop now also recomputes payload transforms from it, including for provider-executed results (the durable loop already did). When a processor rewrites a result, `toModelOutput` and payload transform functions (both input and output phases) run a second time on the rewritten value.

A provider-executed result that arrives in the same response as its call still can't be rewritten by a processor.
