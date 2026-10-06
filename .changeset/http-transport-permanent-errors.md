---
'@mastra/loggers': patch
---

`HttpTransport` no longer retries requests the logging endpoint rejected permanently. A 400, 401, 403, 404, 413 or other client error now fails right away. The rejected batch is dropped and counted in `getDroppedLogCount()`, so it can't block the logs queued behind it. Network errors, timeouts and 408, 425, 429 and 5xx responses are still retried. When a retried response includes a valid `Retry-After` header, the transport waits that long, up to the request `timeout`.
