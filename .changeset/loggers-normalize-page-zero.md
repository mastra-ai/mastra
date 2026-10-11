---
'@mastra/loggers': patch
---

Fixed `HttpTransport` log queries and `UpstashTransport` error results returning `page: 0` when called with `page: 0`. They now report page `1`, consistent with the other transports.
