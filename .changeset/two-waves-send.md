---
'@mastra/core': patch
---

Added `clearThreadSignals(threadId, resourceId)`, a protected method of `MastraMemory` that memory implementations call after deleting a thread. It deletes the thread's stored agent signals from the storage of the Mastra instance the memory is registered with. `@mastra/memory` calls it in `deleteThread()`.
