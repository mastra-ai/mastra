---
'@mastra/core': patch
---

Fixed `ToolNotFoundError` when approving a tool loaded by `ToolSearchProcessor` with `storage: 'context'` after the run resumes without in-process state — for example a `DurableAgent` resuming after a restart or after its run registry entry expired, or `resumeStream` landing on a different instance. The resumed run now rebuilds the loaded tools from the thread's persisted messages.
