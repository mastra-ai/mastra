---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
---

Added importer bookkeeping storage to Knowledge stores (experimental). `KnowledgeStorage.importers` keeps importer bindings, the source-to-page node map, cursor state, runs, flush receipts, per-run changes and a writer guard in the same database and namespace as the pages. On a `knowledge.transaction()` view, it writes in the same transaction as the page writes. In-memory, PostgreSQL and LibSQL stores provide it. Create the tables with `await knowledge.importers.init()`, or from `KnowledgePG.getImportersExportDDL()` / `KnowledgeLibSQL.getImportersExportDDL()` when storage init is disabled.
