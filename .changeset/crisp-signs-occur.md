---
'@mastra/core': patch
---

Fixed `ToolCallFilter({ preserveModelOutput: true })` dropping the compacted tool output, so filtered history kept the tool result instead of losing it entirely.

Custom input processors that read `providerOptions.mastra.modelOutput` from the prompt see it again: prompt assembly no longer removes that marker before processors run.
