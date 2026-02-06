---
'@mastra/client-js': patch
---

Update types and add new methods:

- Updated `CreateStoredAgentParams` and `UpdateStoredAgentParams` types to match server schemas
- Added proper `SerializedMemoryConfig` type with all fields including `embedder` and `embedderOptions`
- Fixed `StoredAgentScorerConfig` to use correct sampling types (`'none' | 'ratio'`)
- Added `listVectors()` and `listEmbedders()` methods to the client
- Added corresponding `ListVectorsResponse` and `ListEmbeddersResponse` types
