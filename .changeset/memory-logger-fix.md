---
'@mastra/core': patch
---

fix(core): update memory loggers in setLogger

When calling `mastra.setLogger()`, memory instances were not being updated
with the new logger. This caused memory-related errors to be logged via the
default ConsoleLogger instead of the configured logger.
