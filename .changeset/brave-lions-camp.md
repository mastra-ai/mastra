---
'@mastra/mongodb': patch
'@mastra/dynamodb': patch
---

Fixed semantic recall latency for large threads. Optimized \_getIncludedMessages() to batch-fetch target message metadata in a single query and use cursor-based range queries (MongoDB) or cached thread data (DynamoDB) instead of loading the entire thread per include entry. Also skips unnecessary COUNT and data queries when only included messages are needed (perPage=0 path used by semantic recall). (Fixes #11702)
