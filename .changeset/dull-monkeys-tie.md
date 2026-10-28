---
'@mastra/core': patch
---

Fixed provider request metadata for fresh, uninterrupted same-process durable and evented agent stream() and generate() calls that finish normally. output.request and onFinish.request now expose the final provider request through private run state. Serialized workflow step outputs no longer echo raw provider request metadata into events or snapshots. Remote workers, resumed/recovered/observed runs, suspension, error/abort/tripwire paths, and historical output.steps request metadata are unchanged.
