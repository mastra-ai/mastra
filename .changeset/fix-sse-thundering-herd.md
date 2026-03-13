---
'@internal/playground': patch
---

Fixed SSE reconnection to use exponential backoff with jitter, preventing thundering herd when the dev server restarts. Also fixed a memory leak where beforeunload listeners accumulated on each reconnection.
