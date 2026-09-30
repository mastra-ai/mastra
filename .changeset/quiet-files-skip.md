---
'@mastra/loggers': patch
---

Fixed FileTransport log queries returning no logs when the log file contains a malformed line. Malformed lines are now skipped and valid logs are still returned.
