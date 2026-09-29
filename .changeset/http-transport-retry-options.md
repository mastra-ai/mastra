---
'@mastra/loggers': patch
---

Fixed `HttpTransport` ignoring explicit `0` and `false` retry options. Setting `retryOptions: { maxRetries: 0 }` now makes a single request, `retryDelay: 0` retries immediately, and `exponentialBackoff: false` uses a constant delay between retries.
