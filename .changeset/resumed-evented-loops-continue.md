---
'@mastra/core': patch
---

Evented agents on PostgreSQL no longer stall after a suspended tool is resumed.

After `resumeStream()` resumed a suspended tool, the tool result and `step-finish` arrived, but the agent never made its next model call. The stream stayed open and the run kept its thread lease, so later runs on the same thread failed with `AgentThreadLeaseConflictError`. The resumed run now continues to the next model call and finishes, freeing the thread for later runs. The same fix applies to evented workflows on PostgreSQL whose loop needs another iteration after a nested workflow is resumed mid-iteration. Fixes #28932.
