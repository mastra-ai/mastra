---
'@mastra/core': patch
---

Fixed spawn error handling in LocalSandbox by switching to execa. Previously, spawning a process with an invalid working directory or missing command could crash with an unhandled Node.js exception. Now returns descriptive error messages instead. Also fixed timeout handling to properly kill the entire process group for compound commands.
