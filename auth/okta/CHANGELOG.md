# @mastra/auth-okta

## 0.0.7-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 0.0.4

### Patch Changes

- Removed Hono from @mastra/core and auth package runtime dependencies. Auth providers now receive framework-agnostic request types that support standard Request objects and Hono-compatible request shapes. MCP and deployer avoid relying on core-bundled Hono context types at package boundaries. ([#17410](https://github.com/mastra-ai/mastra/pull/17410))

- Updated dependencies [[`c973db4`](https://github.com/mastra-ai/mastra/commit/c973db428df1b564ff0c35d4b2a90e8f4f1e13fd), [`552285e`](https://github.com/mastra-ai/mastra/commit/552285e5af43cfc680a0972032cab8de8776c6a0), [`77e686c`](https://github.com/mastra-ai/mastra/commit/77e686c264e493e99ae5024e4dfe3ea5d5a09718), [`ece8dba`](https://github.com/mastra-ai/mastra/commit/ece8dba7ec1a5089eee8c33167cd762bfa91e509), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`e2a8380`](https://github.com/mastra-ai/mastra/commit/e2a838017a7657850404c1e94c70d79ffdc6f14a), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`a34d9db`](https://github.com/mastra-ai/mastra/commit/a34d9dbc39fedb722f271318e9355ecee70489ab)]:
  - @mastra/core@1.39.0

## 0.0.4-alpha.0

### Patch Changes

- Removed Hono from @mastra/core and auth package runtime dependencies. Auth providers now receive framework-agnostic request types that support standard Request objects and Hono-compatible request shapes. MCP and deployer avoid relying on core-bundled Hono context types at package boundaries. ([#17410](https://github.com/mastra-ai/mastra/pull/17410))

- Updated dependencies [[`c973db4`](https://github.com/mastra-ai/mastra/commit/c973db428df1b564ff0c35d4b2a90e8f4f1e13fd), [`552285e`](https://github.com/mastra-ai/mastra/commit/552285e5af43cfc680a0972032cab8de8776c6a0), [`77e686c`](https://github.com/mastra-ai/mastra/commit/77e686c264e493e99ae5024e4dfe3ea5d5a09718), [`ece8dba`](https://github.com/mastra-ai/mastra/commit/ece8dba7ec1a5089eee8c33167cd762bfa91e509), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`e2a8380`](https://github.com/mastra-ai/mastra/commit/e2a838017a7657850404c1e94c70d79ffdc6f14a), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`a34d9db`](https://github.com/mastra-ai/mastra/commit/a34d9dbc39fedb722f271318e9355ecee70489ab)]:
  - @mastra/core@1.39.0-alpha.0

## 0.0.3

### Patch Changes

- Fix endpoint URL construction for Okta org authorization servers. ([#15694](https://github.com/mastra-ai/mastra/pull/15694))

  `MastraAuthOkta` concatenated `/v1/authorize` (and `/token`, `/keys`, `/logout`) directly onto `OKTA_ISSUER`. That yields the right endpoint for a custom authorization server (`https://{domain}/oauth2/default` → `.../oauth2/default/v1/authorize`), but 404s on an Okta org authorization server (`https://{domain}` → `.../v1/authorize`, whereas the real org endpoint is `.../oauth2/v1/authorize`).

  An internal `endpointBase` is now derived from the issuer — verbatim when it already contains `/oauth2/`, otherwise `${issuer}/oauth2` — and used for the authorize, token, keys, and logout URLs. JWT `iss`-claim validation still uses the raw issuer so token validation stays correct on both server types. Trailing slashes on the issuer are also normalized so `OKTA_ISSUER=https://{domain}/` no longer produces `.../oauth2//v1/...`.

- Updated dependencies [[`452036a`](https://github.com/mastra-ai/mastra/commit/452036a0d965b4f4c1efd93606e4f03b50b807a5), [`c272d50`](https://github.com/mastra-ai/mastra/commit/c272d50610a54496b6b6d92ccd4d37b333a2613a), [`27fd1b7`](https://github.com/mastra-ai/mastra/commit/27fd1b79ac62eb7694f92587eb7d1be05b59be01), [`5ba7253`](https://github.com/mastra-ai/mastra/commit/5ba7253745c85e8df8012a76d954c640ffa336f7), [`5556cc1`](https://github.com/mastra-ai/mastra/commit/5556cc1befec71518d84f826b3bfe3a079a9daf7), [`f73980d`](https://github.com/mastra-ai/mastra/commit/f73980d651eb5f7f1ab20582de4615a1b6f10fce), [`5499303`](https://github.com/mastra-ai/mastra/commit/54993032c1ebc09642625b78d2014e0cf84a3cae), [`a702009`](https://github.com/mastra-ai/mastra/commit/a702009d3cfaa745120f501e21c783ed4d6a3072), [`9aee493`](https://github.com/mastra-ai/mastra/commit/9aee493ed6089b5133472623dcce49934bf2d509), [`d8692af`](https://github.com/mastra-ai/mastra/commit/d8692afa253028e39cdce2aafa0ac414071a762e), [`1a9cc60`](https://github.com/mastra-ai/mastra/commit/1a9cc6069f9910fc3d59e4953ac8cd95d89ad6f5), [`8cdb86c`](https://github.com/mastra-ai/mastra/commit/8cdb86ceed1137bc2768e147dce85a0692b9fb26), [`8534d79`](https://github.com/mastra-ai/mastra/commit/8534d791fa1cb70fe1c19e2604c4b63cc10dd051), [`eda90c5`](https://github.com/mastra-ai/mastra/commit/eda90c5bfd7de11805ecc9f4552716c895fbaf78), [`a935b0a`](https://github.com/mastra-ai/mastra/commit/a935b0a0977ae3f196b33ec7621f528069c82db0), [`9c88701`](https://github.com/mastra-ai/mastra/commit/9c8870195b41a38dc40b6ba2aa55eda04df8fa69), [`c78f8cd`](https://github.com/mastra-ai/mastra/commit/c78f8cd6222a86e6c60ae5210b6929ad5221b6fb), [`e146aad`](https://github.com/mastra-ai/mastra/commit/e146aadbba66c410ba0e74bac4c50135495cb8dd), [`ac79462`](https://github.com/mastra-ai/mastra/commit/ac79462b98f1062394c45093aa515b0766f27ee2), [`1a0ec78`](https://github.com/mastra-ai/mastra/commit/1a0ec789a26cae443744e9abbd62ed6ee676af39), [`e47bca7`](https://github.com/mastra-ai/mastra/commit/e47bca7b72866d3abd173b9f530ac4318113a8ff), [`afc004f`](https://github.com/mastra-ai/mastra/commit/afc004f5cc7e30697809e7021820b9f5881e6719), [`0031d0f`](https://github.com/mastra-ai/mastra/commit/0031d0f13831d7843ac5d498734a7d92862e2ce3), [`841a222`](https://github.com/mastra-ai/mastra/commit/841a222560d8c19238f8213713f30535cdd82284), [`64c1e0b`](https://github.com/mastra-ai/mastra/commit/64c1e0b35165c96b659818bd0177aa18794ef11f), [`40d83a9`](https://github.com/mastra-ai/mastra/commit/40d83a90d9be31a1b83e04649edb703eb7753e33), [`4e88dc6`](https://github.com/mastra-ai/mastra/commit/4e88dc6b89f154c0eae37221c8126be0c23c569f), [`19018f0`](https://github.com/mastra-ai/mastra/commit/19018f05722af74a5978781a7731a654b26f7f2a), [`19281c7`](https://github.com/mastra-ai/mastra/commit/19281c70424f757219782de16c2699743c5e04d0), [`3498b49`](https://github.com/mastra-ai/mastra/commit/3498b4946be94f4313cd817733589680dcda5278), [`d52b6fe`](https://github.com/mastra-ai/mastra/commit/d52b6fe1c56853eb38864baae0bbfa75cc739ccb), [`408be73`](https://github.com/mastra-ai/mastra/commit/408be73449dfab92b51eab8c6623b6c443debc25), [`359439b`](https://github.com/mastra-ai/mastra/commit/359439bb8c635e048176306828195f8297f50021), [`71a820b`](https://github.com/mastra-ai/mastra/commit/71a820b2353fa1406772c50760a3732058a8b337), [`1698f5e`](https://github.com/mastra-ai/mastra/commit/1698f5ec141d34f22a873efdb145ce3cdf848a5e)]:
  - @mastra/core@1.36.0

## 0.0.3-alpha.0

### Patch Changes

- Fix endpoint URL construction for Okta org authorization servers. ([#15694](https://github.com/mastra-ai/mastra/pull/15694))

  `MastraAuthOkta` concatenated `/v1/authorize` (and `/token`, `/keys`, `/logout`) directly onto `OKTA_ISSUER`. That yields the right endpoint for a custom authorization server (`https://{domain}/oauth2/default` → `.../oauth2/default/v1/authorize`), but 404s on an Okta org authorization server (`https://{domain}` → `.../v1/authorize`, whereas the real org endpoint is `.../oauth2/v1/authorize`).

  An internal `endpointBase` is now derived from the issuer — verbatim when it already contains `/oauth2/`, otherwise `${issuer}/oauth2` — and used for the authorize, token, keys, and logout URLs. JWT `iss`-claim validation still uses the raw issuer so token validation stays correct on both server types. Trailing slashes on the issuer are also normalized so `OKTA_ISSUER=https://{domain}/` no longer produces `.../oauth2//v1/...`.

- Updated dependencies [[`27fd1b7`](https://github.com/mastra-ai/mastra/commit/27fd1b79ac62eb7694f92587eb7d1be05b59be01), [`a702009`](https://github.com/mastra-ai/mastra/commit/a702009d3cfaa745120f501e21c783ed4d6a3072), [`8534d79`](https://github.com/mastra-ai/mastra/commit/8534d791fa1cb70fe1c19e2604c4b63cc10dd051), [`c78f8cd`](https://github.com/mastra-ai/mastra/commit/c78f8cd6222a86e6c60ae5210b6929ad5221b6fb), [`e146aad`](https://github.com/mastra-ai/mastra/commit/e146aadbba66c410ba0e74bac4c50135495cb8dd), [`1a0ec78`](https://github.com/mastra-ai/mastra/commit/1a0ec789a26cae443744e9abbd62ed6ee676af39), [`d52b6fe`](https://github.com/mastra-ai/mastra/commit/d52b6fe1c56853eb38864baae0bbfa75cc739ccb)]:
  - @mastra/core@1.36.0-alpha.10

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
