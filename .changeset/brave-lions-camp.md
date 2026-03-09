---
'@mastra/mongodb': patch
'@mastra/dynamodb': patch
---

Fixed slow semantic recall in the MongoDB and DynamoDB stores for threads with many messages. Previously, the entire thread was reloaded from the database for each included message. Also skips unnecessary queries when only semantic recall results are needed. (Fixes #11702)
