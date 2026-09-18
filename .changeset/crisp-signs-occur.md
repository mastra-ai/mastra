---
'@mastra/core': patch
---

Fixed `ToolCallFilter({ preserveModelOutput: true })` dropping the compacted tool output, so filtered history keeps the tool result instead of losing it entirely.
