---
'@mastra/loggers': patch
---

Fixed slow, memory-heavy filtered Upstash log queries (log level, date range, custom filters, and run ID lookups) on large log lists. Paginated queries now hold only the requested page in memory while still returning the correct total.
