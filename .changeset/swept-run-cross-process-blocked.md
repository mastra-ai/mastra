---
'@mastra/core': patch
---

Fixed sends from another process to a thread whose claimed owner lost the lease to a swept suspended run. They now return `{ action: 'blocked', reason: 'thread-blocked' }`, the same as a send from the owner's own process, instead of throwing an error.
