---
'@mastra/core': patch
---

Fixed `output.request` and `onFinish.request` for durable and evented agents. Fresh, uninterrupted `stream()` and `generate()` runs that finish normally in the same process now expose the final provider request body. If a local run fails on a provider error, `output.request` reports the failing attempt's request, when available, rather than an earlier step's request. Provider request bodies are kept out of workflow events and snapshots.

**Unchanged cases**

- Remote workers
- Resumed, recovered, or observed runs
- Suspended, aborted, or tripwire runs
- Historical request metadata in `output.steps`
