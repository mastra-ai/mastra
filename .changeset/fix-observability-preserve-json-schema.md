---
'@mastra/observability': patch
---

Fixed span serialization replacing tool parameter JSON schemas with lossy summaries like `"unknown (required)"`. JSON schemas in span data are now preserved as-is, keeping full type information for debugging in observability tools like Datadog. Also fixed MODEL_STEP span input showing only a keys summary instead of actual messages for AI SDK v5 providers.
