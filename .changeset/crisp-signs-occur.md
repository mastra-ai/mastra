---
'@mastra/core': patch
---

Fixed `ToolCallFilter({ preserveModelOutput: true })` losing the compacted tool output, so filtered history no longer dropped the tool result entirely. The internal model-output metadata stays readable by input processors and is now only removed at the point the prompt is sent to the provider. Assistant tool-call parts no longer carry that metadata to providers either.
