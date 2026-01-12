---
'@mastra/ai-sdk': patch
---

Fix data chunk property filtering to only include type, data, and id properties

Previously, when `isDataChunkType` checks were performed, the entire chunk object was returned, potentially letting extra properties like `from`, `runId`, `metadata`, etc go through. This could cause issues with `useChat` and other UI components.

Now, all locations that handle `DataChunkType` properly destructure and return only the allowed properties:
- `type` (required): The chunk type identifier starting with "data-"
- `data` (required): The actual data payload
- `id` (optional): An optional identifier for the chunk

