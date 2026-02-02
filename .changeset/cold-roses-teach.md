---
'@mastra/client-js': minor
'@mastra/memory': minor
'@mastra/server': minor
'@mastra/mongodb': minor
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/pg': minor
---

Added Observational Memory, a new SOTA memory system for high token efficiency, even with very long context conversations.

Core changes:
- New `observationalMemory` feature flag in `coreFeatures`
- New OM storage types and interfaces (optional, additive)
- New `MemoryStorage` methods for OM with default "not implemented" fallbacks
- `processorStates` support for persisting processor state across loop iterations
- Abort signal propagation to processors
- `ProcessorStreamWriter` for custom stream events from processors
- `MessageHistory.persistMessages` extracted as a public method
- `Agent.findProcessor` method for looking up processors by ID

Storage adapters (pg, libsql, mongodb):
- New OM table/collection with conditional creation guarded by `TABLE_OBSERVATIONAL_MEMORY`
- `supportsObservationalMemory` flag set conditionally based on core version

Memory:
- Observational Memory implementation with Observer and Reflector agents
- Thread and resource scoped observation modes
- Manual `observe()` API with locking and scope support

Server:
- New OM status and configuration endpoints
- Runtime guard for `findProcessor` compatibility with older core versions

Client:
- `getMemoryStatus` now accepts optional OM parameters (backward compatible)
