---
'@mastra/core': patch
---

Fix `agent.subscribeToThread()` consumers not receiving chunks from resumed runs (e.g. after `approveToolCall` / `declineToolCall`). The subscription deduplicates runs by id, which incorrectly dropped the second registration when a resumed run kept the same `runId` as the original. The subscription now clears the run id on completion so a future resume can be re-enqueued.
