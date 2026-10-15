---
'@mastra/deployer': patch
---

Added `withModelUsageTelemetry` to `@mastra/deployer/server`. Serverless deployers use it to report the model tokens each request used once its response finishes, including streamed responses, while the platform's `waitUntil` keeps the function running until the report is sent.
