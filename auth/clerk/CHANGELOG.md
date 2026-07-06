# @mastra/auth-clerk

## 1.2.2

### Patch Changes

- Updated dependencies [[`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed)]:
  - @mastra/auth@1.1.2

## 1.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed)]:
  - @mastra/auth@1.1.2-alpha.0

## 1.2.1

### Patch Changes

- Improved auth package builds by removing the direct core dependency from auth providers while preserving the existing public auth APIs. ([#17142](https://github.com/mastra-ai/mastra/pull/17142))

- Updated dependencies [[`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e)]:
  - @mastra/auth@1.1.1

## 1.2.1-alpha.0

### Patch Changes

- Improved auth package builds by removing the direct core dependency from auth providers while preserving the existing public auth APIs. ([#17142](https://github.com/mastra-ai/mastra/pull/17142))

- Updated dependencies [[`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e)]:
  - @mastra/auth@1.1.1-alpha.0

## 1.2.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0
  - @mastra/auth@1.1.0

## 1.2.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0
  - @mastra/auth@1.1.0-alpha.0

## 1.1.1

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0
  - @mastra/auth@1.0.3

## 1.1.1-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/auth@1.0.3-alpha.0
  - @mastra/core@1.43.1-alpha.0

## 1.1.0

### Minor Changes

- Added full Studio authentication support for Clerk users. ([#16659](https://github.com/mastra-ai/mastra/pull/16659))

  **What's new:**
  - **Studio SSO login** — your internal team can now sign in to Mastra Studio using their Clerk accounts via OAuth 2.0/OIDC
  - **JWT validation** — API requests with Clerk-issued JWTs are automatically validated
  - **Session persistence** — Studio sessions are maintained with encrypted cookies (no need to log in repeatedly)

  **Setup:**
  1. Create an OAuth Application in your Clerk Dashboard
  2. Configure the auth provider with your Clerk credentials

  ```typescript
  import { MastraAuthClerk } from '@mastra/auth-clerk';

  const auth = new MastraAuthClerk({
    jwksUri: process.env.CLERK_JWKS_URI,
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    // For Studio SSO login:
    oauthClientId: process.env.CLERK_OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.CLERK_OAUTH_CLIENT_SECRET,
    session: { cookiePassword: process.env.CLERK_COOKIE_PASSWORD },
  });
  ```

  **Note:** This release includes updates to `@mastra/core` (ISSOProvider interface now supports async getLoginUrl) and `@mastra/server` (handles async login URLs). All three packages should be updated together.

### Patch Changes

- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`67bf8e2`](https://github.com/mastra-ai/mastra/commit/67bf8e206dfe583954d96015cf0d09f7ac50e45f), [`8216d05`](https://github.com/mastra-ai/mastra/commit/8216d0528d866eb9a07f5d4c87ea3bb1e1139b45), [`d18b23c`](https://github.com/mastra-ai/mastra/commit/d18b23c5e29dfc381e73e3c51fcf6c779afd1823), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`f9ee2ac`](https://github.com/mastra-ai/mastra/commit/f9ee2ac661af584e61bc063ac208c9035cd752ef), [`c853d53`](https://github.com/mastra-ai/mastra/commit/c853d535d2df84ab89db1adb4c28900c54c9a2d2), [`d8df1f8`](https://github.com/mastra-ai/mastra/commit/d8df1f8e947e1966c9d4e54713df56d0d0d65226), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`ae96523`](https://github.com/mastra-ai/mastra/commit/ae965231f562d9766b0c90c49a69fc68acaa031c), [`17d5a92`](https://github.com/mastra-ai/mastra/commit/17d5a9211aa293b4d4418de3de70dc0394d58101), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`ec4da8a`](https://github.com/mastra-ai/mastra/commit/ec4da8a09e0d2ab452c6ee2c786042ea826b77e5), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`ed346c0`](https://github.com/mastra-ai/mastra/commit/ed346c0bee2d8496690a4e538bfba1e46894660f), [`c9ce1b2`](https://github.com/mastra-ai/mastra/commit/c9ce1b28d10871110648f9d7b6d76e880b9fa999), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`245a9a3`](https://github.com/mastra-ai/mastra/commit/245a9a315705fce17ddd980f78a92504b6615c4a), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`38b5de8`](https://github.com/mastra-ai/mastra/commit/38b5de8e5d1d41a69522addf53d96f4b3a1d5bf0), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`8b984f4`](https://github.com/mastra-ai/mastra/commit/8b984f4361c202270ceb69257185c4756c9a7c56), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd), [`f8ba195`](https://github.com/mastra-ai/mastra/commit/f8ba1954e27ee2b20586cc6cd9cf13c002c232f2)]:
  - @mastra/core@1.43.0

## 1.0.2

### Patch Changes

- Updated dependencies [[`6b7aa31`](https://github.com/mastra-ai/mastra/commit/6b7aa31e2506b03f5cbcc387dd51bf281804ad73)]:
  - @mastra/auth@1.0.2

## 1.0.2-alpha.0

### Patch Changes

- Updated dependencies [[`6b7aa31`](https://github.com/mastra-ai/mastra/commit/6b7aa31e2506b03f5cbcc387dd51bf281804ad73)]:
  - @mastra/auth@1.0.2-alpha.0

## 1.0.1

### Patch Changes

- Updated dependencies [[`ae52b89`](https://github.com/mastra-ai/mastra/commit/ae52b89cf1c78e2ab5231975492a84173dcd04dc), [`1ea40a9`](https://github.com/mastra-ai/mastra/commit/1ea40a99f0104faa528bc13b0ae99a48c3c5201d)]:
  - @mastra/auth@1.0.1

## 1.0.1-alpha.0

### Patch Changes

- Updated dependencies [[`ae52b89`](https://github.com/mastra-ai/mastra/commit/ae52b89cf1c78e2ab5231975492a84173dcd04dc), [`1ea40a9`](https://github.com/mastra-ai/mastra/commit/1ea40a99f0104faa528bc13b0ae99a48c3c5201d)]:
  - @mastra/auth@1.0.1-alpha.0

## 1.0.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Experimental auth -> auth ([#9660](https://github.com/mastra-ai/mastra/pull/9660))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Minor Changes

- remove organization requirement from default authorization ([#10551](https://github.com/mastra-ai/mastra/pull/10551))

### Patch Changes

- Allow provider to pass through options to the auth config ([#10284](https://github.com/mastra-ai/mastra/pull/10284))

- Updated dependencies [[`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc)]:
  - @mastra/auth@1.0.0

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [[`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0)]:
  - @mastra/auth@1.0.0-beta.2

## 1.0.0-beta.2

### Minor Changes

- remove organization requirement from default authorization ([#10551](https://github.com/mastra-ai/mastra/pull/10551))

### Patch Changes

- Updated dependencies:
  - @mastra/auth@1.0.0-beta.1

## 1.0.0-beta.1

### Patch Changes

- Allow provider to pass through options to the auth config ([#10284](https://github.com/mastra-ai/mastra/pull/10284))

- Updated dependencies [[`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371)]:
  - @mastra/auth@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Experimental auth -> auth ([#9660](https://github.com/mastra-ai/mastra/pull/9660))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Patch Changes

- Updated dependencies [[`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc)]:
  - @mastra/auth@1.0.0-beta.0

## 0.10.5

### Patch Changes

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

- Updated dependencies []:
  - @mastra/auth@0.1.3

## 0.10.5-alpha.0

### Patch Changes

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

- Updated dependencies []:
  - @mastra/auth@0.1.3

## 0.10.4

### Patch Changes

- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- Updated dependencies [de3cbc6]
  - @mastra/auth@0.1.3

## 0.10.4-alpha.0

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/auth@0.1.3-alpha.0

## 0.10.3

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies [[`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430)]:
  - @mastra/auth@0.1.2

## 0.10.2

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [4a406ec]
  - @mastra/auth@0.1.1

## 0.10.2-alpha.0

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [4a406ec]
  - @mastra/auth@0.1.1-alpha.0

## 0.10.1

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@clerk/backend@^1.34.0` ↗︎](https://www.npmjs.com/package/@clerk/backend/v/1.34.0) (from `^1.32.3`, in `dependencies`)
  - @mastra/auth@0.1.0

## 0.10.1-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@clerk/backend@^1.34.0` ↗︎](https://www.npmjs.com/package/@clerk/backend/v/1.34.0) (from `^1.32.3`, in `dependencies`)
  - @mastra/auth@0.1.0
