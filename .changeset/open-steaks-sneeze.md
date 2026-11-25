---
'@mastra/core': patch
---

Improved steering of evented agents whose steps run in another process. A message sent to a running evented agent now also cuts short a model request that is still only reasoning when that request runs on another process, such as a worker, so the agent asks again with the message right away instead of after the request finishes. This applies to Postgres and LibSQL storage, which keep agent signals for every process.
