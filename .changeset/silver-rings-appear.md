---
'@mastra/core': patch
---

Fixed a security issue where sensitive observability credentials (such as Langfuse API keys) could be exposed in tool execution error logs. The tracingContext is now properly excluded from logged data.
