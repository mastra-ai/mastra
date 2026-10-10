---
'@mastra/loggers': patch
---

Fixed `FileTransport` silently treating failed log writes as successful. Write errors (for example, a full disk) are now reported instead of logs being lost without notice.
