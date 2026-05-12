---
'mastra': patch
---

Improved `mastra auth login` to skip the browser flow when an existing token is still valid (or can be refreshed) and surface the logged-in user's email.

The `mastra create` observability prompt also prints the logged-in user when authentication resolves from cached credentials, so you can confirm which account you're about to enable observability for.
