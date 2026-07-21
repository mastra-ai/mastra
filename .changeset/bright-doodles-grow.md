---
'@mastra/auth-studio': patch
---

Added `IOrganizationsProvider` implementation to `MastraAuthStudio` so hosts that use it (e.g. self-hosted MastraCode web pointed at a Mastra platform API) can bootstrap a personal organization for no-org users and authorize organization-level admin mutations — matching the behavior of `MastraAuthWorkos` and `MastraAuthBetterAuth`.

The new methods proxy through the shared API's existing endpoints:

- `ensureOrganization(userId)` calls `GET /auth/me` (returns the active org, or the first `memberOrgIds` entry); falls back to `POST /auth/orgs` to create a personal org when the user has no memberships.
- `isOrganizationAdmin(orgId, userId)` reads the role from `GET /auth/me` when checking the active org, else falls back to `GET /auth/orgs` for the per-org role.

Because those endpoints are cookie-authenticated but the interface only provides a userId, `MastraAuthStudio` now caches the sealed `wos-session` cookie last seen for each user inside `verifySessionCookie` (LRU-capped at 1000 users). Bearer-token-only flows (e.g. CLI) skip org bootstrap and return `undefined`/`false` from these methods rather than error.
