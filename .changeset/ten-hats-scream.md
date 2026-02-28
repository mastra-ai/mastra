---
'@mastra/core': patch
---

Added `deleteThread({ threadId })` method to the Harness class for deleting threads and their messages from storage. Releases the thread lock and clears the active thread when deleting the current thread. Emits a `thread_deleted` event.
