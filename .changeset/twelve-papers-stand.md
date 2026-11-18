---
'@mastra/core': patch
---

Fixed background tasks on durable agents with memory failing with "could not verify that this execution still owns the run" or "lost its execution lease" when they suspend after the agent's run has finished. The task is now marked suspended and can be resumed with `backgroundTaskManager.resume()`. This covers tools that call `suspend()` and sub-agents that reach a tool needing approval, including when another evented worker finished the run. A background task's result that arrives while the finished run is still cleaning up is now saved to memory instead of the "Background task started" placeholder.

The fix applies when your storage adapter tracks run ownership, as the in-memory, LibSQL and Postgres stores do. When run ownership lives only in the pubsub lease, a background task that suspends after its run finished still fails as before, because the lease can't show whether another execution took over and finished the run in the meantime. On the evented engine, a background task that suspends after its run was resumed from an approval in the same turn still fails, because the resume's claim counts as another execution. Fixes [#30182](https://github.com/mastra-ai/mastra/issues/30182).
