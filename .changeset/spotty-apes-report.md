---
'@mastra/libsql': patch
---

Fixed schedules failing with "no such column: owner_type" on databases created by older versions. Existing schedules and trigger history are kept, and the upgrade is safe when several processes share the same database.
