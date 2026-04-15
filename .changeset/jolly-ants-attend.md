---
'@mastra/upstash': patch
---

Fixed slow Upstash message saves by using the message index before falling back to scans. Addresses #15386.
