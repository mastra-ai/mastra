---
'@mastra/client-js': patch
'@mastra/server': patch
---

fix: standardize pagination params to page/perPage with backwards compatibility for limit/offset

- Server now accepts both `page`/`perPage` and legacy `limit`/`offset` params for workflow runs and MCP server listing endpoints
- Client SDK sends both param formats to support older server versions
- Added `createCombinedPaginationSchema` helper for endpoints needing backwards compatibility
- Marked `limit` and `offset` as deprecated in client types
