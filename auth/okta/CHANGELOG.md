# @mastra/auth-okta

## 0.0.2-alpha.0

### Patch Changes

- fix(auth-okta): harden security defaults and address code review feedback ([#14553](https://github.com/mastra-ai/mastra/pull/14553))
  - Fix cache poisoning: errors in `fetchGroupsFromOkta` now propagate so the outer `.catch` evicts the entry and retries on next request
  - Reduce cookie size: only store user claims, id_token (for logout), and expiry — access/refresh tokens are no longer stored, keeping cookies under the 4KB browser limit
  - Add `id_token_hint` to logout URL (required by Okta)
  - Add console.warn for auto-generated cookie password and in-memory state store in production
  - Document missing env vars (`OKTA_CLIENT_SECRET`, `OKTA_REDIRECT_URI`, `OKTA_COOKIE_PASSWORD`) in README and examples
  - Expand `MastraAuthOktaOptions` docs to include all fields (session config, scopes, etc.)
  - Fix test to actually exercise `getUserId` cross-provider lookup path

- Updated dependencies [[`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0-alpha.4

## 0.0.1

### Patch Changes

- Initial release with Okta RBAC and Auth integration
