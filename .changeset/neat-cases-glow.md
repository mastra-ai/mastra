---
'@mastra/libsql': patch
---

Improved local LibSQL startup performance by applying local SQLite performance settings before initialization, reducing schema initialization contention, and allowing applications to limit automatic initialization to selected storage domains.
