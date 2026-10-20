---
'@mastra/core': patch
---

`Mastra.shutdown()` now releases the thread leases its agent runs hold and tells other processes the run has ended. Before, a deploy left those leases in place until they timed out, and anyone following the thread from another process saw "lost its lease before publishing a terminal event". Runs that are still streaming are not aborted. Followers see them end without an error, and the thread is free for new input right away. Runs waiting on a tool approval are announced as suspended.
