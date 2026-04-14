---
'@mastra/ai-sdk': minor
---

Added structured output streaming to the AI SDK UI stream. When an agent produces structured output, the final object is now emitted as a `data-structured-output` data part in the UI message stream, making it available to frontends via AI SDK UI's custom data handling.
