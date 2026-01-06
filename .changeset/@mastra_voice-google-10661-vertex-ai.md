---
"@mastra/voice-google": minor
---

Add Vertex AI support to GoogleVoice provider

- Add `vertexAI`, `project`, and `location` configuration options
- Support Vertex AI authentication via project ID and service accounts
- Add helper methods: `isUsingVertexAI()`, `getProject()`, `getLocation()`
- Support `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` environment variables
- Update README with Vertex AI usage examples

This makes `@mastra/voice-google` consistent with `@mastra/voice-google-gemini-live` and enables enterprise deployments using Google Cloud project-based authentication instead of API keys.

