---
'@mastra/docker': patch
---

Fixed Docker sandbox commands hanging when they read standard input. `executeCommand()` now runs with stdin detached, so commands that read standard input when given no file arguments (`rg`, `grep`, `cat`) hit EOF instead of blocking until they are killed. Spawned processes keep stdin attached for `sendStdin()`.
