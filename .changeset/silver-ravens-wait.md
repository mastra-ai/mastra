---
'@mastra/server': minor
---

Added `/api/saved-views` routes to list, create, get, update and delete saved views: named filter and table setups for Studio pages. The server stores a view's `state` as-is after checking that it is a JSON object with an integer `version`, at most 64 KB. Routes answer `501` when the storage has no saved views, and need the `saved-views:read`, `saved-views:write` or `saved-views:delete` permission on authenticated servers.

```http
GET /api/saved-views?page=traces
→ { "views": [{ "id": "…", "page": "traces", "name": "Errors today", "authorId": null, "state": { "version": 1 } }], "pagination": { … } }
```
