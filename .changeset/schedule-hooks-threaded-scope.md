---
'@mastra/core': patch
---

Clarified that schedule `onError` and `onAbort` hooks only observe failures and aborts the schedule worker sees directly. Threaded schedules report failures after a run starts on the thread's own run, not through these hooks.
