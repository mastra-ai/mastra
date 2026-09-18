---
'@mastra/clickhouse': patch
---

Fixed ClickHouse deletion requests blocking updates to feedback that was never actually deleted. Requests are now marked applied only after their delete succeeds, and the feedback update guard ignores unapplied requests. If a delete fails after the request is recorded, the still-visible feedback stays editable; call `deleteFeedback()` again to retry the deletion. On replicated ClickHouse clusters, completed feedback deletions are now recognized consistently on every replica, and re-hiding a revived row no longer records a second deletion request.
