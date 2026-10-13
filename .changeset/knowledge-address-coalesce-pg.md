---
'@mastra/pg': patch
---

Fixed `createNodeWithAddress` reusing an existing node that has the same name in the same scope. It now throws `KnowledgeConflictError`, so the Knowledge importer can keep two different source items as separate nodes.
