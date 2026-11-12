---
'@mastra/dynamodb': patch
---

Mark thread listing as in-memory paginated so limited controller queries read and sort the resource once instead of repeating full reads.
