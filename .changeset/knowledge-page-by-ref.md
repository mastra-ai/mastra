---
'@mastra/core': patch
'@mastra/server': patch
---

`GET /knowledge/:knowledgeKey/pages/:pageId` also opens a page by the reference tools name it with: a scope address (`site:mastra`) or `scope#key/path` (`site:mastra#topics/observability`). It reads only what the caller can read, and an unreadable or unknown reference still returns 404.
