---
"@mastra/auth-okta": patch
---

fix(auth-okta): harden security defaults and address code review feedback

- Fix cache poisoning: errors in `fetchGroupsFromOkta` now propagate so the outer `.catch` evicts the entry and retries on next request
- Reduce cookie size: only store user claims, id_token (for logout), and expiry — access/refresh tokens are no longer stored, keeping cookies under the 4KB browser limit
- Add `id_token_hint` to logout URL (required by Okta)
- Add console.warn for auto-generated cookie password and in-memory state store in production
- Document missing env vars (`OKTA_CLIENT_SECRET`, `OKTA_REDIRECT_URI`, `OKTA_COOKIE_PASSWORD`) in README and examples
- Expand `MastraAuthOktaOptions` docs to include all fields (session config, scopes, etc.)
- Fix test to actually exercise `getUserId` cross-provider lookup path
