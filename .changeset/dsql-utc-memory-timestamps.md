---
'@mastra/dsql': patch
---

Fixed memory thread and resource timestamps being written in the server's local timezone. `createdAt` and `updatedAt` are now stored as UTC, so both timestamp column variants hold the same instant regardless of where the process runs.
