---
'@mastra/loggers': patch
---

Fixed `HttpTransport` retrying logs that the endpoint will never accept. When the endpoint rejects a batch as invalid, such as with a 400 or 413 response, the transport stops retrying right away. It drops that batch and counts it in `getDroppedLogCount()`, so newer logs are no longer stuck behind it.

Temporary failures are still retried, including network errors, timeouts, rate limits and server errors. If the server sends a `Retry-After` header, the transport waits that long before retrying, up to the request `timeout`.
