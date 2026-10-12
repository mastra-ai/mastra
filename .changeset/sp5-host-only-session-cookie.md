---
'@mastra/auth-studio': patch
---

Scope Studio session cookies to the deployment host (host-only by default).

`MastraAuthStudio` previously stamped a shared parent `Domain` (from the `MASTRA_COOKIE_DOMAIN` env var or an auto-detected `.mastra.ai`) on the `wos-session` cookie, which presented the account-scoped session to every sibling host on that parent domain. The cookie is now host-only: no `Domain` is emitted unless the `cookieDomain` option is set explicitly.

`MASTRA_COOKIE_DOMAIN` is no longer honored for setting cookies. A `getLegacySessionClearCookie()` helper is exposed so deployments can emit an expiring clear-cookie for cookies set by older versions. If you relied on the env var to share a session across hosts, set the `cookieDomain` option instead.
