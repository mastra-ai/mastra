---
'@mastra/core': patch
'@mastra/observability': patch
---

Added error name and stack trace to SpanErrorInfo, allowing exporters to access the original error class name and stack trace for richer error reporting.
