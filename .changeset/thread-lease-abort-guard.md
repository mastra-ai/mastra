---
'@mastra/core': patch
---

Thread lease-loss and cross-instance stop handling now skip `abortRunStream` when a run record's agent object does not implement it, instead of raising an unhandled `abortRunStream is not a function` rejection. Agents that implement `abortRunStream` are unaffected.
