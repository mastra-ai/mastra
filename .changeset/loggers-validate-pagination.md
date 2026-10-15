---
'@mastra/loggers': patch
---

Fixed `FileTransport` and `UpstashTransport` log queries accepting invalid `page`/`perPage` values. `listLogs` and `listLogsByRunId` now throw a `RangeError` for negative, fractional, non-finite, or unsafe pagination values instead of silently returning misleading results or sending malformed Redis ranges. `page: 0` and `perPage: 0` still default to page 1 and 100 per page.
