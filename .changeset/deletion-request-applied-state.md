---
'@mastra/clickhouse': patch
---

Fixed ClickHouse deletion requests blocking updates to feedback that was never actually deleted. Requests are now marked applied only after their delete succeeds, and the feedback update guard ignores unapplied requests. If a delete fails after the request is recorded, the still-visible feedback stays editable and calling the delete API again converges.
