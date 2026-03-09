---
'@mastra/mssql': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/lance': patch
'@mastra/cloudflare': patch
---

Fixed slow semantic recall by skipping unnecessary full thread loads and queries when only semantic recall results are needed. Previously, all thread messages were fetched even when only the recalled messages were required. (Fixes #11702)
