---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/dynamodb': patch
'@mastra/upstash': patch
---

A positive `limit` on a session's thread list now reads an expanding, sorted prefix of storage rows until enough eligible threads are found. Session recovery uses the same scoped search; exclusions can require reading more than `limit` rows. Adapters that materialize all matching threads before paginating (in-memory, DynamoDB, and Upstash) read once instead, while MongoDB breaks equal-timestamp ties by thread ID for stable paging. Fractional limits retain the existing truncating behavior.
