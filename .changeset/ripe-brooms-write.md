---
'@mastra/core': patch
---

Fixed abortRunStream so runs without a thread can be stopped by run ID. These runs now pass their run-level abort signal to tools and sub-agents, matching threaded streams.
