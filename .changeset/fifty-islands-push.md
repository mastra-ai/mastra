---
'@mastra/core': patch
---

Fixed `onIterationComplete` callbacks receiving empty `toolResults` after successful tool execution. Tool results now include the matching call ID, tool name, and output from the completed iteration. Fixes [#19453](https://github.com/mastra-ai/mastra/issues/19453).
