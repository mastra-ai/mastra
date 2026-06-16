---
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/libsql': patch
---

Fixed `updateThread` not updating the thread's `updatedAt` timestamp. Renaming a thread or changing its metadata now advances `updatedAt`, so recently-edited threads sort correctly when listing threads by recency and any "changed since" logic sees the new time.
