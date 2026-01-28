---
'@mastra/core': patch
---

Preserve trace continuity across workflow suspend/resume so resumed workflows appear as children of the original span in tracing tools.
