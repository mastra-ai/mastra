---
'@mastra/core': patch
---

When calling `mastra.setLogger()`, memory instances were not being updated with the new logger. This caused memory-related errors to be logged via the default ConsoleLogger instead of the configured logger.
