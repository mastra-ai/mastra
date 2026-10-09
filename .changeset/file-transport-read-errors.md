---
'@mastra/loggers': patch
---

`FileTransport.listLogs` and `listLogsByRunId` now reject with a `MastraError` when the log file cannot be read (for example, it was deleted or is unreadable), instead of logging to the console and returning an empty result that looked like "no logs". Individual malformed lines are still skipped.
