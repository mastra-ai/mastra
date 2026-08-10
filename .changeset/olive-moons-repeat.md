---
'@mastra/core': patch
'@mastra/inngest': patch
---

Make `abort()` stop durable agent runs that are executing in another process

A durable agent's steps often run somewhere other than the process that started them — another replica behind a load balancer, or an Inngest step worker. `abort()` only flipped an in-memory `AbortController`, which those processes never see, so aborting a durable or Inngest agent run silently did nothing in exactly the deployments durable agents exist for.

Abort intent now travels over pubsub. The executing process picks the request up and flips its own controller, so the run unwinds the same way an in-process abort does and still emits its terminal stream event — consumers waiting on the stream are released instead of hanging. `abort()` now returns a promise so callers can await dispatch; ignoring it preserves the previous fire-and-forget behavior.
