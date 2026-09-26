---
'@mastra/core': patch
---

Fixed an unhandled EPIPE error that crashed processes using UnixSocketPubSub when the broker process exited before stream teardown. Unsubscribing after the broker is gone now completes cleanly, and a publish that races `close()` now rejects with a clear "UnixSocketPubSub is closed" error instead of a raw socket error.
