---
'@mastra/pg': patch
---

Set REPLICA IDENTITY USING INDEX on the mastra_workflow_snapshot table so PostgreSQL logical replication can track row updates. Previously, the table only had a UNIQUE constraint (no PRIMARY KEY), causing "cannot update table because it does not have a replica identity and publishes updates" errors when logical replication was enabled.
