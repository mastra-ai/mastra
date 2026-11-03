---
'@mastra/server': patch
---

Added `GET /knowledge/:knowledgeKey/link-counts` and `GET /knowledge/:knowledgeKey/pages/:pageId/links`: exact link counts for a set of pages, and one page's links with the pages at their other ends, both gated by the caller's read scope. They answer 501 on a core or store without a link index.
