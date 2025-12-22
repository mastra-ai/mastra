---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/server': patch
---

Fixed voice transcription endpoint 

The voice transcription endpoint (`/api/agents/:agentId/voice/listen`) now correctly handles multipart/form-data requests for audio uploads rather than only parsing JSON request bodies.

Both Express and Hono adapters now parse multipart/form-data bodies and handle JSON-encoded form fields. The server schema was also updated to use `audio` instead of `audioData` to match the client SDK.
