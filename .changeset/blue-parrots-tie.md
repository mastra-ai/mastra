---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Added the `StorageMemoryRef` type so a stored agent's `memory` field can reference a registered memory instance with `{ type: 'id', memoryId }`, or hold an inline config. Existing inline configs are still accepted.
