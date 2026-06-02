---
"@mastra/loggers": patch
---

Added messageKey option to PinoLogger for compatibility with structured-log aggregators. Set messageKey: 'message' to emit log messages under the message field expected by Google Cloud Logging, Datadog, ECS, and AWS CloudWatch.
