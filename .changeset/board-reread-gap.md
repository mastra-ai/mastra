---
'@internal/factory-ui': patch
---

An open board no longer reads its cards back to back when the server answers slower than the board refreshes. A read that frames queued behind a slow one now waits a full refresh gap after it ends, so a slow server is not kept slow by its own boards.
