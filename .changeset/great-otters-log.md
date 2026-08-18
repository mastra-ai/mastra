---
'@mastra/loggers': minor
---

`PinoLogger` now implements the Mastra logger adapter contract. During traced operations, a pino mixin injects `trace_id` and `span_id` into every native log record (stdout, files, and custom transports), and the observability log export is derived from the same record. User-supplied `mixin` fields are preserved, with trace fields taking precedence on conflict.
