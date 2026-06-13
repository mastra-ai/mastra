---
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Foreach loops now retain completed iteration results, preventing data loss during concurrent workflow execution.
