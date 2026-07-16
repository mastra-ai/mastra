---
'@mastra/dynamodb': patch
---

Fixed listMessages reporting hasMore: true when the remaining thread messages were already returned through include context. DynamoDB now matches other storage adapters: hasMore is false once every thread message has been returned via pagination or include.
