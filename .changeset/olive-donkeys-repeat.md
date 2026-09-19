---
'@mastra/server': patch
---

`POST /auth/logout` no longer reports `{ success: true }` when it cannot log anything out. Previously the route returned 200 unconditionally — including when no auth provider was configured at all — while `POST /auth/refresh` returned 404 for the equivalent missing capability, so clients could not distinguish a real logout from a no-op.

Logout now returns 404 "Logout not configured" when the provider can neither destroy a session, clear session cookies, nor supply an SSO logout URL. Providers that support any one of those are unaffected, including SSO-only providers that implement just `getLogoutUrl`. Logout also remains a 200 when there is no active session, since its desired end state is already satisfied.
