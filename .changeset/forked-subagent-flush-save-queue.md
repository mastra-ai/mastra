---
'@mastra/core': patch
---

Fix forked subagent fork threads starting with empty history. The parent stream's message saves are debounced through `SaveQueueManager`, so a forked subagent that calls `memory.cloneThread` mid-stream used to clone from an empty store and lose the parent's user + assistant turn. The tool now drains the parent save queue via a new `flushMessages` callback on `AgentToolExecutionContext` before cloning, so forks actually carry the prior conversation.
