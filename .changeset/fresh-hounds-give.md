---
'@mastra/core': patch
---

Fixed durable agents running output processors twice on tool results. A `processOutputStream` processor now sees each tool result, tool error, and denied tool call once, so counters, billing, and edits to tool results are no longer applied twice. Fixes part of [#22980](https://github.com/mastra-ai/mastra/issues/22980).
