---
'@mastra/core': patch
---

Added a compile-time type-level parity gate that ensures every field on `AgentExecutionOptionsBase` is accounted for in the durable agent path. When a new field is added to `AgentExecutionOptionsBase`, CI will fail with a clear error showing exactly which keys need to be handled in `SerializableDurableOptions`, `RunRegistryEntry`, or `prepareForDurableExecution`. This prevents silent drift where new Agent options are ignored by the durable execution path.
