---
'@mastra/server': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
---

Added inferred type exports (e.g. StoredAgentResponse, ListStoredAgentsParams) from all schema modules, making @mastra/server/schemas the single source of truth for API types. Also added the JsonSerialized<T> utility type for Date-to-string serialization in JSON responses.
