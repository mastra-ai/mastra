---
'@mastra/loggers': patch
---

Filtered Upstash log queries (log level, date range, custom filters, and run ID lookups) now read the log list in chunks of 1,000 entries instead of downloading the entire list in one request, and only keep the requested page in memory.
