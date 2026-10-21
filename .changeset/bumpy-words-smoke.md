---
'@mastra/connect': minor
---

Added Microsoft Teams as a supported Connect channel. When MASTRA_ENCRYPTION_KEY is unset, the Teams install store is encrypted with a key derived from the platform access token and a warning is logged; projects without a Teams connection are unaffected.
