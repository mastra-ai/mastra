---
'@mastra/core': patch
---

Fixed `UnixSocketPubSub` leaving lease files behind when a lease release was followed immediately by `close()`. The release was aborted mid-way, so a thread claim released during shutdown could stay on disk until another process noticed the holder had exited. A release that starts before `close()` now completes, and `close()` waits for it, for up to one second if another process holds the lease's lock. New lease operations after `close()` still fail.
