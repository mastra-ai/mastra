---
'@mastra/loggers': patch
---

Fixed `UpstashTransport` silently dropping logs when Redis rejects the push command, for example with a `WRONGTYPE` error because the list key holds another type. The batch now stays in the buffer and is retried, and the error is reported, including to the `destroy` callback. If trimming the list fails after the logs were pushed, the error is reported without sending the logs again.
