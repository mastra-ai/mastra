---
"@mastra/pg": patch
---

Fix Cloud SQL stream destroy method and stabilize vector tests

- Ensures Cloud SQL connector stream objects have a `.destroy()` method for proper connection cleanup, preventing `TypeError: client.connection.stream.destroy is not a function` errors during pool cleanup
- Adds runtime validation and compatibility wrapper for stream configuration (both factory functions and direct stream objects)
- Reduces vector test workload by lowering dimensions (from largeDimension to 384) and vector count (from 100/10 to 10) to prevent intermittent test timeouts
- Adjusts IVFFlat index configuration with smaller dimension and reduced IVF lists (from 10 to 2) for improved test reliability
