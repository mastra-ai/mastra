---
'@mastra/auth-studio': patch
'@mastra/server': patch
---

Forward the rotated `wos-session` `Set-Cookie` from the shared API's
`/auth/me` response back to the browser. The platform `sessionAuth`
middleware transparently refreshes an expired access token and re-seals the
session cookie, but `MastraAuthStudio` previously discarded the `Set-Cookie`
header after reading the JSON body. The browser's sealed cookie would stay
frozen at its original value, so the next refresh would hit WorkOS
`invalid_grant` once the previous refresh token was rotated — kicking
authenticated users on the first access-token expiry (~5 minutes).

The server middleware now gives providers a hook
(`consumePendingResponseHeaders`) to attach response headers after a
successful authentication, and `MastraAuthStudio` uses it to propagate the
rotated cookie and invalidate the stale verification-cache entry.
