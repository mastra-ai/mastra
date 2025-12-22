---
'@mastra/express': patch
'@mastra/hono': patch
---

fix(server-adapters): add multipart/form-data support for voice endpoints

- Add FormData parsing to `getParams()` in both Hono and Express adapters
- Map `audio` field to `audioData` to match expected schema for voice listen endpoint
- Parse JSON string fields (like `options`) from FormData
- Use `@fastify/busboy` for Express adapter multipart parsing
- Add error logging for multipart parsing failures

This fixes voice transcription (`/api/agents/:agentId/voice/listen`) which was broken after the server adapters migration because the adapters only parsed JSON bodies, not multipart/form-data.
