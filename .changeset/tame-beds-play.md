---
'@mastra/loggers': patch
---

Fixed `PinoLogger` printing `error: {}` when an `Error` is logged under the `error` key. The error type, message, and stack now appear in log output, and a new `serializers` option lets you customize Pino serializers. Fixes #22870.
