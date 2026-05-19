---
'@mastra/dynamodb': patch
'@mastra/core': patch
---

Fixed background task dispatch races so competing workers keep producer contexts until terminal fan-out events arrive.
