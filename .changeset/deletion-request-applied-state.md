---
'@mastra/clickhouse': patch
---

Fixed ClickHouse deletion requests blocking review updates on feedback that was never deleted. A request is now marked applied only after its delete succeeds, and review updates ignore unapplied requests. If a delete fails, the feedback stays editable; call `deleteFeedback()` again to retry.

Review-status updates now change the feedback row in place instead of inserting a copy, so a concurrent update can no longer bring deleted feedback back. If a newer version of the same feedback event is ingested during an update, the update is re-applied to that version and throws a conflict error after repeated conflicts.

**Breaking:** the database user that runs your application needs two new grants. A user that could update review status before this release fails with `Not enough privileges` until you add them:

```sql
GRANT ALTER UPDATE(reviewStatus) ON <database>.mastra_feedback_events TO <runtime_user>;
GRANT INSERT ON <database>.mastra_feedback_events_delta TO <runtime_user>;
```

Add the grants before you deploy this version. No schema migration is required. If you set `disableInit: true` and run `init()` with separate migration credentials, grant these to the runtime user, not only to the migration user.
