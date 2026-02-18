---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed thread title not being generated for pre-created threads. When threads were created before starting a conversation (e.g., for URL routing or storing metadata), the title stayed as a placeholder because the title generation condition checked whether the thread existed rather than whether it had a title. Threads created without an explicit title now get an empty title instead of a placeholder, and title generation fires whenever a thread has no title. Resolves #13145.
