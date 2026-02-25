---
'@mastra/pg': patch
---

Set REPLICA IDENTITY USING INDEX on the mastra_workflow_snapshot table so PostgreSQL logical replication can track row updates. The table only has a UNIQUE constraint with no PRIMARY KEY, which caused "cannot update table because it does not have a replica identity and publishes updates" errors when logical replication was enabled. Fixes #13097.
