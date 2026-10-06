---
'@mastra/memory': patch
---

Subconscious `knowledge_create` now places a new node on the same scope as its first record when no node placement is given. Previously the node always landed on the thread scope, so a fact captured at resource scope was stored on a node that project-level search and browsing could not see.
