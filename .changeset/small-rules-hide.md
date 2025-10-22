---
'@mastra/braintrust': patch
'@mastra/langsmith': patch
'@mastra/langfuse': patch
---

Fix a `ERR_MODULE_NOT_FOUND` error that was caused by a bad import to `@mastra/core/dist/ai-tracing/exporters/index.js`
