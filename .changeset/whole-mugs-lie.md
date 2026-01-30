---
'@mastra/client-js': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fix PATCH request JSON-body handling in `@mastra/client-js` so stored agent edit flows work correctly. Fix stored agent schema migration in `@mastra/libsql` and `@mastra/pg` to drop and recreate the versions table when the old snapshot-based schema is detected, clean up stale draft records from partial create failures, and remove lingering legacy tables. Restores create and edit flows for stored agents.
