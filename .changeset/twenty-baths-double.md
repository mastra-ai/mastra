---
'@mastra/memory': patch
---

Fixed the Observational Memory Observer and Reflector agents so they use the logger configured on the Mastra instance instead of the default ConsoleLogger. Previously, errors during background observation and reflection cycles bypassed your configured logger and were printed to stdout as unstructured object dumps.
