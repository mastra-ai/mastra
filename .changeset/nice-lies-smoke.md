---
'@mastra/core': patch
---

Reorganize and expand stream type exports from @mastra/core/stream

- Consolidated all type exports into a single organized export statement
- Added missing chunk types: ToolCallChunk, ToolResultChunk, SourceChunk, FileChunk, ReasoningChunk
- Added missing payload types: ToolCallPayload, ToolResultPayload, TextDeltaPayload, ReasoningDeltaPayload, FilePayload, SourcePayload
- Added JSON utility types: JSONValue, JSONObject, JSONArray and their readonly variants
- Improved code organization with clear categorization of core types, chunk types, payload types, and JSON types
