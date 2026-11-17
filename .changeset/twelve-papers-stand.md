---
'@mastra/core': patch
---

Fixed background tasks on durable agents with memory failing with "could not verify that this execution still owns the run" when they suspend after the agent's run has finished. The task is now marked suspended and can be resumed with `backgroundTaskManager.resume()`. This covers tools that call `suspend()` and sub-agents that reach a tool needing approval, including when another evented worker finished the run. A background task's result that arrives while the finished run is still cleaning up is now saved to memory instead of being dropped. A background task no longer stays `running` while storage is slow to confirm that the finished run gave up its claim.

The fix applies when your storage adapter tracks run ownership, as the in-memory, LibSQL and Postgres stores do. When run ownership lives only in the pubsub lease, a background task that suspends after its run finished still fails as before, because the lease can't show whether another execution took over and finished the run in the meantime. Fixes [#30182](https://github.com/mastra-ai/mastra/issues/30182).
