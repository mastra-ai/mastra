---
'@mastra/core': patch
---

Reduced durable agent snapshot size when crash recovery is on. Running snapshots no longer save a copy of the full provider request (prompt and tool schemas) for each tool-calling step. Resume and recovery behave the same as before. Fixes #26462.
