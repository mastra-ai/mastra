---
'@mastra/factory': patch
---

Fixed session materialization timing being overwritten when sessions resume. The initial-materialize timestamp is now recorded once and preserved across idle-reap, checkpoint restore, and sandbox recreation, so time-to-first-materialize measurements reflect the true initial cost. Historical metrics captured before this fix are not backfilled.
