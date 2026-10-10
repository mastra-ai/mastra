---
'@mastra/core': patch
---

Fixed abortRunStream so runs without a thread can be stopped by run ID. These runs now pass their run-level abort signal to tools and sub-agents, matching threaded streams. After a run settles, aborting the caller signal no longer reaches tools or sub-agents that retained the run signal.
