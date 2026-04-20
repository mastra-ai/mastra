---
'@mastra/core': minor
---

Processor traces now store hook-specific inputs and only include changed outputs, reducing payload size while keeping traces more replayable. If you consume `PROCESSOR_RUN` payloads directly, update any dashboards or parsers that depend on the previous shape.
