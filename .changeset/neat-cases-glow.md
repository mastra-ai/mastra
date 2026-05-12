---
'@mastra/libsql': patch
---

Improved local LibSQL startup performance by applying conservative local SQLite performance settings before initialization, exposing local PRAGMA overrides, and reducing schema initialization contention.
