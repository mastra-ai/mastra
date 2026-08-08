---
'@mastra/core': patch
---

Fixed workflow watch events re-publishing stale step state, which could grow to megabytes per event. `workflow-step-start` events spread the step's previous result into their payload, so on loops (including durable agent runs) every start event shipped the previous iteration's `output` next to a byte-identical input `payload`. On Cloudflare Workers this made the request streaming a durable agent run exceed the 128 MB isolate memory limit and fail, even though the run itself kept executing. Watch events now only carry the fields describing the current transition: the input (`payload` or `resumePayload`), timestamps, and `status` on start events, plus the fresh result on `workflow-step-result` and `workflow-step-suspended` events. A step's prior `output`, `error`, and suspend state are no longer re-published on later events. Persisted run snapshots are unchanged.
