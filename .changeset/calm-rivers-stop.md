---
'@mastra/server': patch
---

Knowledge tree and graph routes stop a read after 25 seconds and answer 422 with a message, instead of querying storage until the read finishes. Studio stops polling a graph that ran out of time.
