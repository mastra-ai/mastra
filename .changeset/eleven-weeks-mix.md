---
'@mastra/cloudflare-d1': patch
---

Fixed D1 listMessages returning empty results when using semantic recall with perPage=0 and many include targets, by batching UNION ALL queries to avoid SQLite's compound SELECT limit
