---
'@mastra/core': patch
'@mastra/deployer': patch
'@mastra/hono': patch
'@mastra/voice-inworld': patch
'@mastra/voice-openai-realtime': patch
'@mastra/voice-xai-realtime': patch
'@mastra/voice-google-gemini-live': patch
---

Raised the minimum `ws` version to 8.23.0, which limits pending automatic pongs and terminates the connection when that limit is exceeded.
