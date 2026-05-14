### 5.1b Session Summaries and Durable Work

This group is the bounded read-model layer over the active records in §5.1a.
It owns the storage-adapter projection of a session row, the durable-work
ledger that covers admitted-but-not-yet-complete operations across kinds, and
the list-row shapes the public navigation/reconnect APIs return so callers
do not infer UI state from raw storage scans.

The records here do not introduce a new recovery guarantee on their own; they
are JSON-safe projections derived from the authoritative session, queue,
inbox, wakeup, channel, and outbox rows declared elsewhere in §5.

Field declarations live in the child files below; this page is the cross-child
reader map only.

- `05-session-summary-records.md` declares `SessionSummary`, the
  `SessionLifecycleStatus` / `PendingInboxKind` enums, `SessionThreadLabel`,
  `SessionRunProjection`, `SessionGoalSummary`,
  `SessionChannelBindingSummary`, and `SessionPendingInboxSummary`.
- `06-background-task-records.md` declares the `DurableWorkKind` /
  `DurableWorkStatus` enums and the durable-work source row shapes used by
  background task observation and recovery.
- `07-durable-work-summary.md` declares `DurableWorkSummary` plus the
  source-durability / proof advisory fields shared across kinds.
- `08-activity-and-session-list-records.md` declares
  `DurableWorkListSummary` and the session-list row shapes returned by
  navigation and activity surfaces.
