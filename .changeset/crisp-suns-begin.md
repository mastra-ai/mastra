---
'@mastra/core': patch
---

The workflow `storageVersion: 2` option now works with `@mastra/pg` and `@mastra/libsql` as well as in-memory storage, and is no longer experimental. Also fixed parallel steps that finish at the same time occasionally leaving an outdated step result in a version 2 run.
