---
'@mastra/server': minor
---

Added `/api/saved-views` routes to list, create, get, update and delete saved views: named filter and table setups for Studio pages.

- The list returns up to 100 views per page. Use `perPage` (1 to 100) and the zero-based `pageIndex` to page through more, while `pagination.hasMore` is `true`.
- Create records the caller as `authorId` and `updatedById`. Update records the caller as `updatedById`.
- Delete answers `{ "deleted": true }`.
- The server stores a view's `state` as-is after checking that it is a JSON object with an integer `version`, at most 64 KB.
- With `server.storedResources.scope` on, each view belongs to the caller's scope. Lists only include views in that scope, and views in other scopes answer `404`.
- Routes answer `501` when the storage has no saved views, and need the `saved-views:read`, `saved-views:write` or `saved-views:delete` permission on authenticated servers.

```http
GET /api/saved-views?page=traces&perPage=100&pageIndex=0
→ { "views": [{ "id": "…", "page": "traces", "name": "Errors today", "authorId": null, "updatedById": null, "state": { "version": 1 } }], "pagination": { "total": 1, "page": 0, "perPage": 100, "hasMore": false } }
```
