---
'@mastra/core': patch
---

- Fixed DurableAgent returning stale/empty values for Studio metadata, processors, skills, workflows, voice, and other inherited Agent accessors by adding delegation overrides to the wrapped agent
- Fixed missing traces in Studio: span `entityId` now uses the durable agent's ID instead of the wrapped agent's ID
- Fixed dropped `background-task-completed` events in `streamUntilIdle` caused by the same agent ID mismatch
- `\_\_setMemory`, `\_\_setPubSub`, and `\_\_setWorkspace` now propagate to both the DurableAgent base class and the wrapped agent
