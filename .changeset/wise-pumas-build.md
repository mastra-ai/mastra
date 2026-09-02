---
'@mastra/factory': patch
---

Fixed personal memory settings in the web app showing (and running) the default Gemini observer model after signing in with another provider. Signing in with a provider OAuth flow or saving a personal API key now seeds your unset observer and reflector models from that provider, matching the TUI onboarding behavior.
