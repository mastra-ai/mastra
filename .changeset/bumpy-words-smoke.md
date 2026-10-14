---
'@mastra/connect': minor
---

Added Microsoft Teams as a supported Connect channel. channels() now fails at startup with a configuration error when MASTRA_ENCRYPTION_KEY is missing and a Microsoft Teams connection is active; projects without a Teams connection are unaffected.
