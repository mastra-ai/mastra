---
'@mastra/core': patch
---

Fixed an evented agent race where a follow-up sent immediately after a finish frame could fail because the previous run was still releasing the thread.
