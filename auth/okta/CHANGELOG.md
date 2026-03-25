# @mastra/auth-okta

## 0.0.2

### Patch Changes

- fix(auth-okta): harden security defaults and address code review feedback ([#14553](https://github.com/mastra-ai/mastra/pull/14553))
  - Fix cache poisoning: errors in `fetchGroupsFromOkta` now propagate so the outer `.catch` evicts the entry and retries on next request
  - Reduce cookie size: only store user claims, id_token (for logout), and expiry — access/refresh tokens are no longer stored, keeping cookies under the 4KB browser limit
  - Add `id_token_hint` to logout URL (required by Okta)
  - Add console.warn for auto-generated cookie password and in-memory state store in production
  - Document missing env vars (`OKTA_CLIENT_SECRET`, `OKTA_REDIRECT_URI`, `OKTA_COOKIE_PASSWORD`) in README and examples
  - Expand `MastraAuthOktaOptions` docs to include all fields (session config, scopes, etc.)
  - Fix test to actually exercise `getUserId` cross-provider lookup path

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0

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
