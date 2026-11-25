---
'@mastra/core': patch
---

Fixed storage-fenced evented agent runs being canceled when Redis pauses longer than the thread lease, even though the worker still owns the run.
