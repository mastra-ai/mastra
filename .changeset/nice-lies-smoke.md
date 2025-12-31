---
'@mastra/core': patch
---

Added missing stream types to @mastra/core/stream for better TypeScript support

**New types available:**
- Chunk types: `ToolCallChunk`, `ToolResultChunk`, `SourceChunk`, `FileChunk`, `ReasoningChunk`
- Payload types: `ToolCallPayload`, `ToolResultPayload`, `TextDeltaPayload`, `ReasoningDeltaPayload`, `FilePayload`, `SourcePayload`
- JSON utilities: `JSONValue`, `JSONObject`, `JSONArray` and readonly variants

These types are now properly exported, enabling full TypeScript IntelliSense when working with streaming data.
