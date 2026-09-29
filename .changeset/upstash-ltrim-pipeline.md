---
'@mastra/loggers': patch
---

Fixed the Upstash logger so `maxListLength` actually trims the log list. Trim arguments were previously stored as log entries, causing unbounded list growth and unreadable entries in `listLogs()`.
