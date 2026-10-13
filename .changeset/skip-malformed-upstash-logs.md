---
'@mastra/loggers': patch
---

Fixed `UpstashTransport` returning empty `{}` log records for list entries that are not valid JSON. Unparseable entries are now skipped, so log queries return only real records and snapshot totals no longer count corrupt entries.
