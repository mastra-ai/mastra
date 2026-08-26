---
'@mastra/playground-ui': patch
---

Added `presentTool` to the `ai/tool-call` component set: maps a tool name and its arguments to an icon, a human label, and the salient argument to surface on the row (with special handling for terminal-style tools whose command drives the expanded body). Added `ToolCallMono`, the monospace body block of an expanded call with a hover copy button, and `ToolCallPresentedHeader`, the canonical row header (icon, label, detail, failure mark, chevron) so apps no longer assemble it by hand. `ToolCallDetail` now fades in on its own when it lands inside an `ArrivalScope`. All moved from Mastra Factory so every studio surface presents tool calls the same way.
