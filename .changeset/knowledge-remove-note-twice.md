---
'@mastra/pg': patch
'@mastra/mongodb': patch
---

Removing a Knowledge note that's already removed now fails with `KnowledgeNotFoundError` on PostgreSQL and MongoDB, as it already did on LibSQL, MySQL and in memory. Before, these two stores returned the removed note, so a note update that raced another one could leave both copies live.
