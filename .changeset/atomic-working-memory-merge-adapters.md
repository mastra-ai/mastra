---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
---

LibSQL, MongoDB and the in-memory store now merge resource-scoped working memory atomically, like PostgreSQL already does. Concurrent updates to the same resource's working memory (for example the working memory tool in one thread and observational memory in another, or agents running in separate processes) no longer overwrite each other's fields.

LibSQL and MongoDB use a compare-and-swap that retries on conflict, so the guarantee holds across processes, on standalone MongoDB as well as replica sets, without a schema migration.
