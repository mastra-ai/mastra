---
"@mastra/server": patch
---

Fix Studio's provider connection banner incorrectly showing Google and Vertex AI as disconnected.

- Google now connects with either `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`, not both.
- Vertex AI is now checked separately from Google AI Studio, using its own `GOOGLE_VERTEX_PROJECT` and `GOOGLE_VERTEX_LOCATION` settings.
