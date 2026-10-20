---
'@mastra/core': minor
'@mastra/libsql': patch
'@mastra/pg': patch
---

Knowledge importers now say which scopes each node belongs in with `scopes` (and can import their own containers as scopes with `isScope`), and one importer source can sync into several projects at once. Before, binding the same source to a second project failed with "changed outside importer". Each binding now keeps its own records, state and run history, while both share one node per source item. A provider-confirmed deletion removes only that binding's records and never deletes the node, and edits made outside the importer are still rejected.
