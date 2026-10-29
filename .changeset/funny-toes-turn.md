---
'@mastra/core': patch
---

Fixed background tasks cancelled from another process continuing to run. When a task was cancelled on a different worker sharing the same storage, the worker running it marked the task cancelled but let the tool keep executing to completion. The running tool's abort signal now fires on that worker's next lease renewal, so the tool stops as cancelled.
