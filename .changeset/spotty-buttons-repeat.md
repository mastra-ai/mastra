---
'@mastra/server': patch
---

Fixed invalid pagination query parameters returning a 500 instead of a 400.

Requests such as `?page=-1`, `?page=1.5`, or `?perPage=-5` used to pass request validation and were only rejected deep in the storage layer, which surfaced them as `500 Internal Server Error`. Malformed client input is now rejected at the request boundary and returns `400 Bad Request` naming the offending field, matching what `GET /api/workflows/:workflowId/runs` already did.

**Before**

```
GET /api/memory/threads?resourceId=user-1&page=-1
→ 500 Internal Server Error   { "error": "page must be >= 0" }
```

**After**

```
GET /api/memory/threads?resourceId=user-1&page=-1
→ 400 Bad Request
  { "error": "Invalid query parameters", "issues": [{ "field": "page", "message": "..." }] }
```

This affects every paginated endpoint built on the shared pagination schemas, including memory, logs, MCP, and the stored agent/skill/scorer routes. `perPage=0` stays valid, since storage uses it as the include-only fast path.
