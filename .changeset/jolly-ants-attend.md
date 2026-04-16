---
'@mastra/upstash': patch
---

Fixed slow Upstash message saves by using the message index and treating unindexed messages as new, avoiding full database scans. Also adds index-first lookups to updateMessages. Addresses #15386.
