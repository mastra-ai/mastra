---
'@mastra/factory': minor
---

Added a bounded Knowledge scope-lens API so Factory clients can navigate large graphs without loading the whole Knowledge instance or revealing inaccessible links.

```http
GET /web/factory/projects/:id/knowledge/subgraph?scopeId=kh_scope&limit=250
```
