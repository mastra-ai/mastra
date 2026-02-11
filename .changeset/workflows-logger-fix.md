---
"@mastra/core": patch
---

Fix setLogger to update workflow loggers

When calling `mastra.setLogger()`, workflows were not being updated with the new logger. This caused workflow errors to be logged via the default ConsoleLogger instead of the configured logger (e.g., PinoLogger with HttpTransport), resulting in missing error logs in Cloud deployments.
