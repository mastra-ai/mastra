---
'@mastra/factory': patch
---

Factory Knowledge tree and graph reads stop after 25 seconds, the graph's grant lookup included, and answer 422 `query_too_expensive`, so the client stops polling them instead of waiting on a read that keeps querying storage.
