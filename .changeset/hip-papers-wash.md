---
'@mastra/core': patch
---

Fixed a hang when two streams were started for the same workflow run at once. Resuming or time-traveling a suspended run twice concurrently (a double-clicked approval, a client retry, or two open tabs) left one of the two streams open forever, so the matching resume-stream or time-travel-stream HTTP request never ended. Each stream now closes itself independently.
