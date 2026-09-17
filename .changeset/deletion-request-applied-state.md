---
'@mastra/clickhouse': patch
---

Fixed ClickHouse deletion requests blocking review updates after a failed delete. Requests are marked applied after successful deletion, and review updates ignore unapplied requests. Review-status updates now modify existing rows without recreating deleted feedback, including when a replica is behind. They require `ALTER UPDATE` permission on feedback events and `INSERT` permission on feedback delta events when polling is enabled. If a delta write fails after the status changes, the API returns an error and retrying the review update publishes the notification. Concurrent deletion-request writes retry temporary quorum contention; other failures remain recoverable by retrying the delete API.
