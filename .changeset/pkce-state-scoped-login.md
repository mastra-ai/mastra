---
'@mastra/auth-cloud': patch
---

Fixed a race condition in the Mastra Cloud auth provider where two users signing in with SSO at the same time could receive each other's PKCE verifier cookies. Login state is now tracked per request, keyed by the OAuth state parameter, so concurrent logins can no longer cross-wire cookies. Fixes [#20203](https://github.com/mastra-ai/mastra/issues/20203)
