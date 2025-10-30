---
'@mastra/playground-ui': major
'@mastra/client-js': major
'@mastra/deployer': major
'@mastra/memory': major
'@mastra/server': major
'@mastra/core': major
---

Replace `getThreadsByResourceIdPaginated` with `listThreadsByResourceId` across memory handlers. Update client SDK to use `listThreads()` with `offset`/`limit` parameters instead of deprecated `getMemoryThreads()`. Consolidate `/api/memory/threads` routes to single paginated endpoint.
