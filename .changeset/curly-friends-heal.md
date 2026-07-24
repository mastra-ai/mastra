---
'@mastra/libsql': patch
---

Added durable storage for explicit experiment execution and scorer counts, per-item execution status, and experiment threshold snapshots in the LibSQL provider. Existing experiment tables are upgraded in place, and historical rows derive target execution counts from the legacy counters.
