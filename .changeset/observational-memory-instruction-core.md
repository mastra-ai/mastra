---
'@mastra/core': minor
---

Add optional `instruction` field to ObservationalMemory config types

Adds `instruction?: string` to `ObservationalMemoryObservationConfig` and `ObservationalMemoryReflectionConfig` interfaces, allowing external consumers to pass custom instructions to observational memory.