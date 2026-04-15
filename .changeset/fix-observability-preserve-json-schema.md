---
'@mastra/observability': patch
---

Fixed span serialization replacing tool parameter JSON schemas with lossy summaries like `"unknown (required)"`. JSON schemas in span data are now preserved as-is, keeping full type information for debugging in observability tools like Datadog.
