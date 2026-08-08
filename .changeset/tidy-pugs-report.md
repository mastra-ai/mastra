---
'@mastra/server': patch
---

Return 400 instead of 500 for invalid pagination query params

`page` and `perPage` were declared as `z.coerce.number()` with no integer or lower bound, so `page=-1`, `page=1.5` and `page=1e20` passed request validation and reached storage. Storage rejects them with a plain `Error` that carries no HTTP status, so the response fell back to `500` — counting a malformed client request against server error rate and paging whoever is on call.

Both shared pagination factories now constrain these to non-negative integers, so the route framework rejects them at the HTTP boundary with a `400` and field-level issues, matching what `GET /api/workflows/:workflowId/runs` already did. `perPage: 0` stays valid — it is the include-only storage fast path.
