---
'mastracode': patch
---

Added Claude Max OAuth warning for Anthropic authentication

A warning now appears when authenticating with Anthropic via OAuth, alerting that using a Claude Max subscription through OAuth is a grey area that may violate Anthropic's Terms of Service.

- During `/login` or onboarding: **Continue** proceeds with OAuth, **Cancel** returns to the provider selection screen.
- At startup (when existing Anthropic OAuth credentials are detected and the warning has not been acknowledged): **Continue** keeps credentials, **Remove OAuth** logs out from Anthropic.
- The startup warning only appears once — acknowledging it persists the choice in settings.
