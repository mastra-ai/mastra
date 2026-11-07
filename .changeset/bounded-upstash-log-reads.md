---
'@mastra/loggers': patch
---

Fixed `UpstashTransport` reading the entire Redis log list for filtered queries, `listLogsByRunId`, and `returnPaginationResults: false`. These reads are now limited to the configured `maxListLength` retention window, keeping each read bounded even when the stored list contains older entries outside that window.
