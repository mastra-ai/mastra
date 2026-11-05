---
'@mastra/pg': minor
'@mastra/libsql': minor
---

Runs stored with the experimental workflow `storageVersion: 2` option can now be written by several workers at once, as evented workflows and `createEventedAgent` do. Concurrent `foreach` iterations all save their results, and the store writes a full copy of the workflow state after 100 changes so loading a long run stays fast.
