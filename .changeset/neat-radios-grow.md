---
'@mastra/voice-google-gemini-live': patch
'@mastra/voice-openai-realtime': patch
'@mastra/voice-xai-realtime': patch
'@mastra/hono': patch
'@mastra/deployer': patch
'@mastra/core': patch
'@mastra/voice-inworld': patch
---

Updated the ws dependency to ^8.21.0 to pull in fixes for an uninitialized memory disclosure (GHSA-58qx-3vcg-4xpx) and a memory exhaustion denial-of-service (GHSA-96hv-2xvq-fx4p) in the WebSocket server.
