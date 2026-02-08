---
'@mastra/playground-ui': patch
---

Fix memory configuration in agent forms:

- Fixed memory configuration in agent forms to use `SerializedMemoryConfig` object instead of string
- Added `MemoryConfigurator` component for proper memory settings UI
- Fixed scorer sampling configuration to remove unsupported 'count' option
- Added `useVectors` and `useEmbedders` hooks to fetch available options from API
- Fixed agent creation flow to use the server-returned agent ID for navigation
- Fixed form validation schema to properly handle memory configuration object
