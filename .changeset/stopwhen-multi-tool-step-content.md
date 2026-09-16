---
'@mastra/core': patch
---

Fixed `stopWhen` step data for multi-tool agent steps. The step's `content` and tool result arrays now include every completed tool result, matching the behavior already provided to input-step processors.
