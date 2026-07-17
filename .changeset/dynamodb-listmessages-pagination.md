---
"@mastra/dynamodb": patch
---

Fixed `listMessages()` silently truncating large threads, returning incorrect pagination metadata, and failing to retrieve included-message context beyond the first DynamoDB page. Large threads now return complete paginated results with correct `total` and `hasMore`, and `include` lookups (e.g. jumping to a message deep in a thread) again return the requested surrounding context instead of partial or empty windows.

