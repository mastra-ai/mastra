---
'@mastra/memory': patch
---

Fixed a crash in Observational Memory token counting for tool calls that wait for approval. Threads that hold a tool invocation in the `approval-requested` or `approval-responded` state no longer throw `Unhandled tool-invocation state`, so memory extraction keeps running on approval-gated conversations.

The counter also no longer stops on a tool-invocation state it does not know. A message that a different `@mastra/core` version wrote now gets an estimate instead of an error.
