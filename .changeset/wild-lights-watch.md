---
'@mastra/observability': patch
---

Reduced startup noise: CloudExporter missing-token message is now logged at debug level instead of warn, since being disabled is the expected state for local development
