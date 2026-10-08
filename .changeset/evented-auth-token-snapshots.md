---
'@mastra/core': patch
---

Fixed the evented workflow engine storing the signed-in caller's bearer token in plain text in workflow snapshots. Evented workflows and evented agents now leave `mastra__authToken` out of every snapshot they save, the same as the default engine, and a resumed run no longer restores a token left in an older snapshot. Steps still receive the live token while the run executes. Fixes [#26217](https://github.com/mastra-ai/mastra/issues/26217).
