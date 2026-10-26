---
'@mastra/auth-studio': patch
'@mastra/factory': patch
'@mastra/server': patch
'@mastra/core': patch
---

Studio session cookies are now host-only, so a session is never sent to other deployments on a shared domain.

`@mastra/auth-studio`: on secure deployments `MastraAuthStudio` issues `__Host-wos-session` (`Secure`, `Path=/`, no `Domain`). `MASTRA_COOKIE_DOMAIN` is no longer used as the cookie `Domain`. A legacy `wos-session` cookie is still accepted on read, but only so it can be re-issued as `__Host-wos-session`. The new `getLegacySessionClearCookies()` expires the legacy `wos-session` on the current host, on `MASTRA_COOKIE_DOMAIN`, and on each domain in `MASTRA_LEGACY_COOKIE_DOMAINS` (or the `legacyCookieDomains` option). Plain-http `localhost` dev keeps an unprefixed host-only cookie; use `secureCookies` to override. An explicit `cookieDomain` option still issues a `wos-session` cookie with that `Domain`.

`@mastra/server`: the SSO callback, `POST /auth/refresh` and `POST /auth/logout` responses now also send the provider's `getLegacySessionClearCookies()`.

`@mastra/factory`: the default Studio provider no longer derives `Domain=.mastra.cloud` from `publicUrl`. Its sign-in and sign-out responses also expire legacy session cookies.

`@mastra/core`: `ISessionProvider` gains the optional `getLegacySessionClearCookies()`.
