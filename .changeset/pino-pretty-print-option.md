---
"@mastra/loggers": patch
---

Fixed: PinoLogger now supports JSON output for log aggregators

Previously, PinoLogger always used pino-pretty which produced multiline
colored output, breaking log aggregators like Datadog, Loki, and CloudWatch.
A new prettyPrint option allows switching to single-line JSON output.
