---
'@mastra/mssql': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/lance': patch
'@mastra/cloudflare': patch
---

Improved semantic recall performance for large message histories. Semantic recall no longer loads entire threads when only the recalled messages are needed, eliminating delays that previously scaled with total message count. (Fixes #11702)
