---
'@mastra/core': patch
---

Fixed an unhandled rejection when a run lost its thread lease and its agent could not abort the run. Lease loss and remote abort requests now ignore an agent that has no `abortRunStream` or whose abort throws, so the failure no longer escapes a background callback or fails the abort request.
