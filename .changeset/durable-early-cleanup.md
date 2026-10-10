---
'@mastra/core': patch
---

Fixed a durable agent thread staying busy forever when `cleanup()` was called before the run finished. Cleanup now waits for the run to settle, so `onFinish`/`onError` fire and the thread is released for the next request. Fixes #25974.
