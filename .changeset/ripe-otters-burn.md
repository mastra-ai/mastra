---
'@mastra/core': patch
---

Preserve trace continuity across workflow suspend/resume for workflows run by the default engine, so resumed workflows appear as children of the original span in tracing tools.
