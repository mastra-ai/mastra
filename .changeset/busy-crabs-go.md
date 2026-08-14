---
'@mastra/factory': patch
---

Fixed `source_control_sessions.materialized_at` being overwritten on every session resume. It is now write-once, so the initial-materialize baseline used for TTFME/materialize timing is no longer corrupted when a session is resumed after Railway idle-reap, checkpoint restore, or sandbox recreate.
