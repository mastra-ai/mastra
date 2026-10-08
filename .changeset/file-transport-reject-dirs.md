---
'@mastra/loggers': patch
---

Fixed `FileTransport` accepting a directory as its log path. It now throws a clear error at construction instead of failing later with an `EISDIR` stream error.
