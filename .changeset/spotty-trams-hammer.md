---
'@mastra/client-js': patch
'@mastra/core': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/playground-ui': patch
---

Fix stored agents functionality and type consistency:

## Server (`@mastra/server`)
- Fixed auto-versioning bug where `activeVersionId` wasn't being updated when creating new versions
- Added `GET /vectors` endpoint to list available vector stores
- Added `GET /embedders` endpoint to list available embedding models
- Added validation for memory configuration when semantic recall is enabled
- Fixed version comparison in `handleAutoVersioning` to use the active version instead of latest
- Added proper cache clearing after agent updates

## Client SDK (`@mastra/client-js`) 
- Updated `CreateStoredAgentParams` and `UpdateStoredAgentParams` types to match server schemas
- Added proper `SerializedMemoryConfig` type with all fields including `embedder` and `embedderOptions`
- Fixed `StoredAgentScorerConfig` to use correct sampling types (`'none' | 'ratio'`)
- Added `listVectors()` and `listEmbedders()` methods to the client
- Added corresponding `ListVectorsResponse` and `ListEmbeddersResponse` types

## Core (`@mastra/core`)
- Updated `SerializedMemoryConfig` to allow `embedder?: EmbeddingModelId | string` for flexibility
- Exported `EMBEDDING_MODELS` and `EmbeddingModelInfo` for use in server endpoints

## Editor (`@mastra/editor`)
- Fixed memory persistence bug by handling missing vector store gracefully
- When semantic recall is enabled but no vector store is configured, it now disables semantic recall instead of failing
- Fixed type compatibility for `embedder` field when creating agents from stored config

## Playground UI (`@mastra/playground-ui`)
- Fixed memory configuration in agent forms to use `SerializedMemoryConfig` object instead of string
- Added `MemoryConfigurator` component for proper memory settings UI
- Fixed scorer sampling configuration to remove unsupported 'count' option
- Added `useVectors` and `useEmbedders` hooks to fetch available options from API
- Fixed agent creation flow to use the server-returned agent ID for navigation
- Fixed form validation schema to properly handle memory configuration object
