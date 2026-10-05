---
'@mastra/loggers': patch
---

Fixed `HttpTransport` dropping buffered logs on shutdown. Destroying the transport now sends every remaining batch instead of only the first one. It first waits for any flush already in progress, including `_flush()` calls made directly, so a failed request can no longer put logs back after shutdown. Destroy reports an error, instead of success, when a batch fails or when logs cannot be sent.
