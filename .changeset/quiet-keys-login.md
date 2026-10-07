---
'mastracode': minor
---

Added `mastracode login` to sign in to a provider or save an API key from the terminal, without starting the interactive app. It exits when sign-in finishes, so editors can run it for ACP terminal sign-in.

```bash
mastracode login
mastracode login --provider anthropic
```

Pass `--provider` to skip the menu and go straight to that provider's sign-in.
