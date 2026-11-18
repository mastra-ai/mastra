---
'@mastra/loggers': patch
---

Fixed `UpstashTransport` reading the entire Redis log list for filtered queries, `listLogsByRunId`, and `returnPaginationResults: false`. When `maxListLength` is positive, these reads now return at most the newest `maxListLength` entries.
