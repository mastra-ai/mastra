---
'@mastra/auth-studio': minor
---

Added `@mastra/auth-studio` — an auth provider for deployed Mastra Studio instances that proxies authentication through the Mastra shared API.

Deployed instances need no secrets — all WorkOS authentication is handled by the shared API. The package provides SSO login/callback flows, session management via sealed cookies, RBAC with organization-scoped permissions, and automatic forced account picker on deploy logins.
