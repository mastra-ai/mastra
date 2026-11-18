---
'@mastra/core': patch
---

Evented agents on PostgreSQL no longer stall after a suspended tool is resumed.

After `resumeStream()` resumed a suspended tool, the tool result and `step-finish` arrived, but the agent never made its next model call. The stream stayed open and the run kept its thread lease, so later runs on the same thread failed with `AgentThreadLeaseConflictError`. Resumed runs now continue to the next loop iteration and finish. This affected any evented workflow on PostgreSQL that loops over a nested workflow and is resumed mid-iteration. Fixes #28932.
