---
'mastracode': patch
---

Fixed OAuth logins (such as Anthropic and OpenAI sign-in) not being recognized for the selected model. The model status bar no longer shows a false "missing API key" error, and the `/api-keys` command and web settings panel now display a distinct "oauth" status for providers you are signed into instead of treating them as unset.
