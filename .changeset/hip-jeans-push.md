---
'@mastra/pg': patch
---

Faster thread listing when filtering by metadata. Postgres now adds an index on thread metadata, so listing a resource's threads by tags (for example the agent controller's `tags` filter) no longer reads every thread of that resource. The index is built without blocking writes the first time the store initializes; databases whose thread metadata column is still text are left unchanged.
