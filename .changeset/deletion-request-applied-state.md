---
'@mastra/clickhouse': patch
---

Fixed ClickHouse deletion requests blocking review updates on feedback that was never deleted. A request is now marked applied only after its delete succeeds, and review updates ignore unapplied requests. If a delete fails, the feedback stays editable; call `deleteFeedback()` again to retry.

Review-status updates now change the feedback row in place instead of inserting a copy, so a concurrent update can no longer bring deleted feedback back. This requires `ALTER UPDATE` permission on `mastra_feedback_events` and, when delta polling is enabled, `INSERT` permission on `mastra_feedback_events_delta`. If newer feedback is ingested during an update, the update is re-applied to the newest version and throws a conflict error after repeated conflicts.
