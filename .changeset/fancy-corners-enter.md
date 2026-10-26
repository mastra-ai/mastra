---
'@mastra/pg': patch
---

Fixed process crashes when a connection drops while checked out from a pool owned by PostgresStore or PgVector. Interrupted queries still reject, and later queries reconnect. Fixes [#28234](https://github.com/mastra-ai/mastra/issues/28234).
