---
'@mastra/core': patch
---

Fixed `output.request` and `onFinish.request` for durable and evented agents. Fresh, uninterrupted `stream()` and `generate()` runs that finish normally in the same process now expose the final provider request body. Provider request bodies are kept out of workflow events and snapshots.

**Unchanged cases**

- Remote workers
- Resumed, recovered, or observed runs
- Suspended, errored, aborted, or tripwire runs
- Historical request metadata in `output.steps`
