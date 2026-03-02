---
'@mastra/pg': patch
---

Run describeIndex queries sequentially to avoid concurrent queries on a single pg client
