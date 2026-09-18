---
'@mastra/core': patch
---

Fixed `ToolCallFilter({ preserveModelOutput: true })` losing the compacted tool output, so filtered history no longer dropped the tool result entirely.

The prompt metadata stripping introduced in a recent release removed the internal model-output marker before input processors could read it, which broke the filter. That stripping has been reverted, so the marker travels with the prompt again.
