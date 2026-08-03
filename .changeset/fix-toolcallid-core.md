---
'@mastra/core': patch
'@mastra/inngest': patch
---

Added toolCallId to TOOL_CALL and MCP_TOOL_CALL span attributes so observability exporters can pair tool results with their calls. Previously the tool call ID was available at the call site but never forwarded to the span, causing downstream exporters to lose the association between a tool call and its result.
