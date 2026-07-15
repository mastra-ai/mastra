---
'@mastra/core': patch
---

Moved the embedding model router to the AI SDK v6 provider SDKs (OpenAI, Google, and OpenAI-compatible). The router still exposes the same embedding interface, so no code changes are needed. Also extended internal test coverage so agent streaming and tool handling are now verified against AI SDK v5, v6, and v7 provider SDKs.
