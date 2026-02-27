---
'mastracode': minor
---

Added support for ANTHROPIC_API_KEY as the primary authentication method for Anthropic models. When the environment variable is set, mastracode now uses it directly instead of requiring Claude Max OAuth. OAuth remains as a fallback when no API key is configured.
