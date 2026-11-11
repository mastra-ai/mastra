---
'@mastra/core': patch
---

Fixed `MessageHistory` mishandling a thread that is set only in the request context, when the agent has no Memory instance and the thread comes from `requestContext.set('MastraMemory', ...)`. Saved messages are now stored under the thread the processor resolved, so `listMessages({ threadId })` finds the turn instead of the rows landing under a blank thread id (or being rejected by stores like Postgres). The finish-path `memory:write` check now runs for that thread, instead of being skipped while the save still happened. And an output-processor tripwire now rolls the saved reply back: the undo uses the storage the processor wrote to, so a blocked reply no longer stays in the thread.
