---
'@mastra/core': minor
'@mastra/libsql': patch
'@mastra/pg': patch
---

Knowledge importers now say which scopes each node belongs in with `scopes` (and can import their own containers as scopes with `isScope`), and one importer source can sync into several projects at once. Before, binding the same source to a second project failed with "changed outside importer". Each project now gets its own copy of every imported item: its own nodes, records, state and run history, so one project's sync can never change or remove another project's data. Importers keep using their own record ids. A provider-confirmed deletion removes only that project's records and never deletes the node, and edits made outside the importer are still rejected.
