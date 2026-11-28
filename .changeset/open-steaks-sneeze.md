---
'@mastra/core': patch
---

Improved steering of evented agents whose steps run in another process, such as a worker. A message sent to a running agent now also cuts short a model request that has produced only reasoning so far when that request runs in another process, so the agent asks again with the message right away instead of after the request finishes.

This applies when the agent is evented, has memory whose storage shares pending signals across processes (Postgres or LibSQL on a shared database), the run has a thread and a `resourceId`, and the pubsub reaches the process running the request.
