---
'@mastra/pg': patch
---

Fixed thread `updatedAt` timestamp inconsistency when using PostgresStore. Previously, thread creation and updates used different timestamp formats, causing incorrect ordering in `listThreads()` for users in non-UTC timezones. Also fixed sorting to use timezone-aware columns for correct ordering of both new and existing data.
