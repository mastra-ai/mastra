---
'@mastra/clickhouse': minor
---

Fixed ClickHouse deletion requests blocking review updates on feedback that was never deleted. A request is now marked applied only after its delete succeeds, and review updates ignore unapplied requests. If a delete fails, the feedback stays editable; call `deleteFeedback()` again to retry.

Review-status updates now change the feedback row in place instead of inserting a copy, so a concurrent update can no longer bring deleted feedback back. If a newer version of the same feedback event is ingested during an update, the update is re-applied to that version and throws a conflict error after repeated conflicts.

**Upgrade note:** `updateFeedbackReviewStatus()` now runs `ALTER TABLE … UPDATE` on `mastra_feedback_events`, so the runtime database user needs `ALTER UPDATE(reviewStatus)` on that table, and `INSERT` on `mastra_feedback_events_delta` if it does not already have it. A user limited to `SELECT` and `INSERT`, which was enough for review updates before this release, now fails with `Not enough privileges`:

```sql
GRANT ALTER UPDATE(reviewStatus) ON <database>.mastra_feedback_events TO <runtime_user>;
GRANT INSERT ON <database>.mastra_feedback_events_delta TO <runtime_user>;
```

Add the grants before you deploy this version. No schema migration is required. If you set `disableInit: true` and run `init()` with separate migration credentials, grant these to the runtime user, not only to the migration user.
