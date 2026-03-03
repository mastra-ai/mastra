---
'@mastra/mysql': patch
---

Improved MySQL storage reliability and startup behavior.

- Fixed table initialization when the database is inferred from the active connection.
- Fixed batched message updates to skip no-op items and avoid invalid SQL.
- Improved delete and create safety to reduce partial-write states in multi-step operations.
- Improved error reporting when update requests target missing resources.
- Added stricter guards for delete statements with empty key filters.
- Improved pretest startup checks so test runs fail fast when MySQL never becomes ready.
