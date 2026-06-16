---
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/libsql': patch
---

Fixed updateThread not refreshing a thread's updatedAt timestamp. Editing a thread's title or metadata now bumps updatedAt, so edited threads correctly resurface when listing threads sorted by most recently updated.
