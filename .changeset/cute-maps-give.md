---
'mastracode': patch
---

Added ANTHROPIC_API_KEY support as a fallback for Anthropic model resolution. Previously, anthropic/\* models always required Claude Max OAuth. Now, when not logged in via OAuth, mastracode falls back to the ANTHROPIC_API_KEY environment variable or a stored API key credential.
