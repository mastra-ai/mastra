---
'@mastra/core': patch
---

Fix workflow cancel not updating status when workflow is suspended

- `Run.cancel()` now updates workflow status to 'canceled' in storage, fixing the issue where suspended workflows remained in 'suspended' status after cancellation
- `EventedRun.cancel()` calls `super.cancel()` first to ensure immediate status update, then publishes event for watchers
- `processWorkflowCancel()` no longer calls `endWorkflow()` which was overwriting the status to 'success'
