---
'mastracode': patch
---

Fixed onboarding to allow API-key-only setup without requiring OAuth login. Previously, users with API keys configured as environment variables were blocked at the model pack selection step if they skipped OAuth login during onboarding. The auth step now clearly indicates that OAuth is optional when API keys are set.
