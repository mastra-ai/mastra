---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
---

Added importer bookkeeping storage to Knowledge stores (experimental). `KnowledgeStorage.importers` keeps importer bindings, the source-to-page node map (with an `unsettled` flag and `listNodes({ unsettled: true })`, and each node's links indexed by target for `listLinkingNodes()`), cursor state, runs, flush receipts, per-run changes and a writer guard in the same database and namespace as the pages. On a `knowledge.transaction()` view, it writes in the same transaction as the page writes. In-memory, PostgreSQL and LibSQL stores provide it. Create the tables with `await knowledge.importers.init()`, or from `KnowledgePG.getImportersExportDDL()` / `KnowledgeLibSQL.getImportersExportDDL()` when storage init is disabled. `retireBinding(id)` deletes a binding with its nodes, cursor state, runs, flush receipts and changes, and leaves its pages alone.

`dangerouslyReset()` now also empties the importer tables in the same namespace, in the same transaction as the pages, and moves the writer generation forward. Stop importer runs before calling it. A store whose importer tables were never created is reset without creating them.
