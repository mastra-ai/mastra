---
'@mastra/loggers': patch
---

Fixed `HttpTransport` and `UpstashTransport` modifying log objects passed to them. When a record has no timestamp, the transport now adds `time` to its own copy, so the caller's object stays unchanged and frozen records are sent instead of failing with a `TypeError`.
