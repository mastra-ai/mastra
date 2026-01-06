---
'@mastra/cloudflare': patch
'@mastra/upstash': patch
---

Fix message sorting in listMessages when using semantic recall (include parameter). Messages are now always sorted by createdAt instead of storage order, ensuring correct chronological ordering of conversation history.
