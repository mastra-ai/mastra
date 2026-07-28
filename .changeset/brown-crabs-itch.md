---
'mastracode': patch
---

Fixed observational memory staying on the Gemini default after you sign in to Anthropic or OpenAI. First-run setup and `/login` now select the small, cheap OM model of the provider you just connected, and the TUI tells you when it does. An OM model you picked yourself is never replaced.

Providers with no cheap OM model (GitHub Copilot, xAI) no longer pin observation and reflection to their full-size coding model — OM stays open so a later login can set it.

When an OM run fails, the hint names the model OM is using and keeps the advice for the actual failure, so an authentication error still points at `/login` and a rate limit still tells you to wait, alongside `/memory` to switch OM models.
