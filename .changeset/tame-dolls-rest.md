---
'@mastra/core': patch
---

Fixed workflow schedule engine promotion. Manual executions of scheduled workflows now run on the default in-process engine rather than evented engine, preventing hangs on serverless environments.
