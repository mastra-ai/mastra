---
'create-agentbuilder': patch
'@mastra/core': patch
'@mastra/duckdb': patch
'mastra': patch
---

Fixed Mastra.shutdown() not releasing database file handles when storage is composed with MastraCompositeStore. close() now cascades to the underlying default/editor stores and to domain overrides that hold their own connection, so setups like LibSQL + DuckDB observability release their locks on shutdown instead of leaving the DuckDB write lock held across dev server restarts.
