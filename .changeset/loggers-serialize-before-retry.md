---
'@mastra/loggers': patch
---

Fixed `HttpTransport` retrying JSON serialization failures. Log batches are now serialized once before sending: values that cannot be serialized (circular references, BigInts, throwing `toJSON`) fail immediately instead of waiting through retry delays, and network retries resend the exact same payload.
