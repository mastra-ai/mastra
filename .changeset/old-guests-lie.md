---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed missing schema backfill for experiment tables. Existing databases created before the review pipeline feature would fail with 'column status does not exist' because the experiments init() was not calling alterTable to add newer columns (status, tags, agentVersion). Now properly adds missing columns on startup, matching the pattern used by other storage domains.
