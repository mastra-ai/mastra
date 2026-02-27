---
'@mastra/core': patch
---

Added test coverage for async thread locking in `Harness`.

- Verifies `createThread` waits for a Promise-returning `threadLock.acquire` before releasing the previous thread lock.
- Verifies `switchThread` does not resolve until a Promise-returning `threadLock.release` completes.
