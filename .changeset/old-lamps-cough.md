---
'@mastra/server': patch
---

Fixed `POST /api/agents/:agentId/generate` cancelling a durable agent run on a memory thread when the client disconnects. The run now finishes. To get the answer back, subscribe to the thread with `withRunStatus` and observe the run ID it reports. Calls without a memory thread still cancel on disconnect, since the client has no way to find the run again.
