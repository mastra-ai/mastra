---
'@mastra/core': patch
---

Fixed recovery of ToolSearchProcessor-loaded tools after a crash in an evented agent, preserving the interrupted tool call ID. Fixes https://github.com/mastra-ai/mastra/issues/28171.
