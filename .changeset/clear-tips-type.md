---
'@mastra/mysql': patch
---

Fixed `listExperiments` in the MySQL store ignoring `targetType`, `targetId`, `agentVersion`, and `status` filters. Queries now correctly narrow on these fields, matching the behavior of the other stores (Postgres, LibSQL, Spanner, in-memory).

Also persisted `agentVersion` on experiment rows in the MySQL store. The column existed in the schema but `createExperiment` never wrote it and `getExperimentById`/`listExperiments` never returned it, so filtering by `agentVersion` would have matched nothing on rows created by this backend. New experiments now round-trip `agentVersion` end-to-end. Existing tables gain the column via the `init()` backfill.
