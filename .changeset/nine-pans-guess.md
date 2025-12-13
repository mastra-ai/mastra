---
'@mastra/core': patch
---

Fix workflow cancel not updating status when workflow is suspended

- `Run.cancel()` now updates workflow status to 'canceled' in storage, resolving the issue where suspended workflows remained in 'suspended' status after cancellation
- Cancellation status is immediately persisted and reflected to observers
