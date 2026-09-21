---
'@mastra/mongodb': patch
---

`createNodeWithAddress` no longer coalesces onto an existing same-named node in the same scope — address-bound nodes are identified by their address, not their name. A live name collision now throws `KnowledgeConflictError` so callers (the knowledge static importer) can disambiguate instead of silently merging two distinct source entities into one node.
