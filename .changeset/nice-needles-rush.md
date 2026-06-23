---
'mastracode': minor
---

Added automatic OpenAI subscription support for Stagehand browser automation. When a user has an active OpenAI subscription (authenticated via /login), Stagehand now uses the subscription credentials for its AI operations (act/extract/observe) instead of requiring a separate OPENAI_API_KEY.
