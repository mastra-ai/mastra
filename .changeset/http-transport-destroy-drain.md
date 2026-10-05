---
'@mastra/loggers': patch
---

Fixed `HttpTransport` dropping buffered logs on shutdown. Destroying the transport now sends every remaining batch instead of only the first one, waits for any flush already in progress, and stops at the first failed batch with that error.
