---
'@mastra/server': patch
---

Knowledge tree and graph routes stop a read after 25 seconds, the graph's grant lookup included, and answer 422 with a message, instead of querying storage until the read finishes.
