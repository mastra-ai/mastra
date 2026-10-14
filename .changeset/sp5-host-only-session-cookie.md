---
'@mastra/auth-studio': patch
'@mastra/factory': patch
'@mastra/server': patch
---

Scope session cookies to the deployment host (host-only by default).

`@mastra/auth-studio`: `MastraAuthStudio` previously stamped a shared parent `Domain` (from the `MASTRA_COOKIE_DOMAIN` env var or an auto-detected `.mastra.ai`) on the `wos-session` cookie, which presented the account-scoped session to every sibling host on that parent domain. The cookie is now host-only unless the `cookieDomain` option is set explicitly. `MASTRA_COOKIE_DOMAIN` is no longer honored for setting; `getLegacySessionClearCookie()` lets deployments expire legacy parent-scoped cookies.

`@mastra/factory`: the default `MastraAuthStudio` provider no longer derives a parent cookie domain from `publicUrl`, so a `<sub>.mastra.cloud` deploy mints a host-only session cookie. Deployments that relied on the shared parent domain for cross-subdomain SSO should pass `cookieDomain` (or their own provider) via `auth:`.

`@mastra/server`: responses that set or clear the session cookie — the SSO callback, `POST /auth/refresh` and `POST /auth/logout` — now also send the provider's `getLegacySessionClearCookie()` value. A browser only deletes a cookie whose exact `(name, Domain, Path)` matches, so without it a copy still scoped to the old shared parent domain keeps being sent to sibling hosts until it expires.
