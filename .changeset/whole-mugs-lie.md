---
'@mastra/client-js': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed stored agent schema migration to handle the old agent_versions table that used a snapshot column instead of individual config columns. The migration now drops and recreates the versions table when the old schema is detected, cleans up stale draft records from partial createAgent failures, and removes lingering legacy tables.
