---
'@mastra/server': patch
---

Detach disconnected HTTP observers from durable and evented agent runs instead of aborting execution. Apply this to streaming starts, resumes, tool approvals/declines, and recovery, while retaining request cancellation for ordinary agents. Runs continue saving their final answer, and clients can reconnect through `/observe`. Aborting a fetch only disconnects its observer. Use the explicit thread-abort endpoint or `POST /agents/:agentId/runs/:runId/abort` to stop durable execution, including runs without a memory thread.
