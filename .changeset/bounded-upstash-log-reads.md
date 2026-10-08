---
'@mastra/loggers': patch
---

Fixed `UpstashTransport` reading the entire Redis log list for filtered queries, `listLogsByRunId`, and `returnPaginationResults: false`. These reads are now capped at `maxListLength`, the retention length the transport already enforces when it flushes, so results stay the same and the size of each read is now limited.
