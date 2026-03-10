---
'@mastra/mongodb': patch
'@mastra/dynamodb': patch
---

Fixed slow semantic recall on large threads in the MongoDB and DynamoDB memory stores. Included message lookups now avoid unnecessary work when semantic recall only needs specific messages and nearby context. (Fixes #11702)
