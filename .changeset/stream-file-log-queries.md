---
'@mastra/loggers': patch
---

`FileTransport` log queries now read the log file as a stream instead of loading it synchronously, so `listLogs()` no longer blocks the event loop and paginated queries only keep the requested page in memory. `listLogsByRunId()` now finds matching logs beyond the first 100 records.
