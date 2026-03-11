---
'@mastra/pg': patch
---

Fixed thread `updatedAt` timestamp inconsistency when using PostgresStore. Previously, thread updates used a different timestamp format than creation, causing incorrect ordering in `listThreads()` for non-UTC timezones. Fixed `listThreads()` ordering in `@mastra/pg` for non-UTC timezones, including existing threads.
