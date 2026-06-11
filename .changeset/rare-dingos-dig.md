---
'@mastra/core': patch
---

Fixed workflow snapshot records leaking in storage for every agent run. The agentic loop's nested execution workflow persisted a snapshot row that was never cleaned up, so completed agent runs left behind stale "pending" or "suspended" records in workflow snapshot storage indefinitely. This affected both execution engines: the default engine now deletes the nested row together with the loop's row when a run completes, and the evented engine deletes a nested run's row when it reaches a terminal state its workflow opted not to persist. A "suspended" status in storage now reliably means the run is actually resumable.
