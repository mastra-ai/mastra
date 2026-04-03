---
"@mastra/playground-ui": patch
---

Expired sessions now refresh automatically. Requests that previously returned 401 are retried after refreshing, so users stay signed in instead of being logged out.
