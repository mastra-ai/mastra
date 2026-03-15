---
'@mastra/core': minor
---

Added `MEMORY_OPERATION` span type, `MEMORY` entity type, and `MemoryOperationAttributes` interface to the observability system. Added optional `tracingContext` parameter to the abstract `MastraMemory` methods (`recall`, `saveMessages`, `deleteMessages`, `updateWorkingMemory`) so memory operations can participate in traces. Agent and network code now threads tracing context into memory calls automatically.
