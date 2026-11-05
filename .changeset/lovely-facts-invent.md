---
"mastracode": patch
"@mastra/code-sdk": patch
---

Mastra Code now runs on AI SDK v7. Claude, OpenAI, Codex, Kimi, xAI sign-in, GitHub Copilot and custom endpoints use the v7 provider packages. Sign-ins, API keys, thinking levels, prompt caching and image tool results work as before, including when you switch providers mid-thread. Vertex AI, Bedrock, and models served through `@mastra/core` such as Gemini keep their current provider packages.
