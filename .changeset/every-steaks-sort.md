---
'@mastra/server': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/core': patch
---

Added new /api/processors endpoints to list, get details, and execute processors. Processor workflows are now auto-detected based on their schema - workflows using ProcessorStepSchema as their input schema are automatically recognized as processor workflows without requiring explicit configuration.
