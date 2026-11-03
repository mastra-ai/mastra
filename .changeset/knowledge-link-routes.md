---
'@mastra/server': patch
---

Added `GET /knowledge/:knowledgeKey/link-counts` and `GET /knowledge/:knowledgeKey/pages/:pageId/links`: exact link counts for a set of pages, and one page's links with the pages at their other ends, both gated by the caller's read scope. They answer 501 on a core or store without a link index.

```http
GET /api/knowledge/docs/link-counts?pageId=p1&pageId=p2
→ { "counts": { "p1": { "in": 3, "out": 1 }, "p2": { "in": 0, "out": 2 } } }

GET /api/knowledge/docs/pages/p1/links?direction=in
→ { "edges": [{ "fromPageId": "p7", "toPageId": "p1", "kind": "body", "count": 1 }], "pages": [{ "id": "p7", ... }], "truncated": false }
```
