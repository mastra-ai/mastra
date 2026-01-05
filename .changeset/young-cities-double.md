---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/server': patch
---

Fixed voice transcription endpoint

The voice transcription endpoint (`/api/agents/:agentId/voice/listen`) now correctly handles multipart/form-data requests for audio uploads rather than only parsing JSON request bodies.

Both Express and Hono adapters now parse multipart/form-data bodies and handle JSON-encoded form fields.

**Breaking change:** The server schema field for the transcription endpoint was renamed from `audioData` to `audio` to match the client SDK. If you are making direct API calls to the transcription endpoint (not using the SDK), you will need to update your request body to use `audio` instead of `audioData`.
