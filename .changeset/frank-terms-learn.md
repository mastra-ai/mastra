---
'@mastra/server': patch
---

Fixed PATCH /api/memory/threads/:threadId silently ignoring an empty title. Sending an empty string as the title now clears the thread title instead of keeping the previous one. Omitting the title still leaves it unchanged.
