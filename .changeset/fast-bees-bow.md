---
'@mastra/agent-browser': minor
---

Added `storageState` option and `exportStorageState()` method for lightweight auth persistence (cookies and localStorage). Also kills orphaned Chrome child processes on close to prevent zombies.
