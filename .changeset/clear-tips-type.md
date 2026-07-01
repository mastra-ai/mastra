---
'@mastra/mysql': patch
---

Fixed `listExperiments` in the MySQL store ignoring `targetType`, `targetId`, `agentVersion`, and `status` filters. Queries now correctly narrow on these fields, matching the behavior of the other stores (Postgres, LibSQL, MongoDB, Spanner, in-memory).
