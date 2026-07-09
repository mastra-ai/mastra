# @mastra/auth

## 1.1.2

### Patch Changes

- Fixed a TypeScript error where auth provider instances (for example `new MastraAuthWorkos()`) could not be assigned to `server.auth` or `studio.auth`, failing with `Property '#private' is missing` (#18682). ([#18796](https://github.com/mastra-ai/mastra/pull/18796))

  Auth providers are now typed with a new structural `IMastraAuthProvider` interface (exported from `@mastra/core/server` and `@mastra/auth`), so provider packages no longer need a shared class identity with `@mastra/core`. `CompositeAuth` also accepts any `IMastraAuthProvider` implementation. No code changes are required:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { MastraAuthWorkos } from '@mastra/auth-workos';

  // Previously failed to compile with TS2322, now works without casts
  export const mastra = new Mastra({
    server: {
      auth: new MastraAuthWorkos(),
    },
  });
  ```

## 1.1.2-alpha.0

### Patch Changes

- Fixed a TypeScript error where auth provider instances (for example `new MastraAuthWorkos()`) could not be assigned to `server.auth` or `studio.auth`, failing with `Property '#private' is missing` (#18682). ([#18796](https://github.com/mastra-ai/mastra/pull/18796))

  Auth providers are now typed with a new structural `IMastraAuthProvider` interface (exported from `@mastra/core/server` and `@mastra/auth`), so provider packages no longer need a shared class identity with `@mastra/core`. `CompositeAuth` also accepts any `IMastraAuthProvider` implementation. No code changes are required:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { MastraAuthWorkos } from '@mastra/auth-workos';

  // Previously failed to compile with TS2322, now works without casts
  export const mastra = new Mastra({
    server: {
      auth: new MastraAuthWorkos(),
    },
  });
  ```

## 1.1.1

### Patch Changes

- Improved auth package builds by removing the direct core dependency from auth providers while preserving the existing public auth APIs. ([#17142](https://github.com/mastra-ai/mastra/pull/17142))

## 1.1.1-alpha.0

### Patch Changes

- Improved auth package builds by removing the direct core dependency from auth providers while preserving the existing public auth APIs. ([#17142](https://github.com/mastra-ai/mastra/pull/17142))

## 1.1.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0

## 1.1.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0

## 1.0.3

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0

## 1.0.3-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 1.0.2

### Patch Changes

- Fixed Studio showing unauthenticated state when using `MastraJwtAuth` with custom headers. `MastraJwtAuth` now implements the `IUserProvider` interface (`getCurrentUser`/`getUser`), so the Studio capabilities endpoint can resolve the authenticated user from the JWT Bearer token. ([#14411](https://github.com/mastra-ai/mastra/pull/14411))

  Also added an optional `mapUser` option to customize how JWT claims are mapped to user fields:

  ```typescript
  new MastraJwtAuth({
    secret: process.env.JWT_SECRET,
    mapUser: payload => ({
      id: payload.userId,
      name: payload.displayName,
      email: payload.mail,
    }),
  });
  ```

  Closes #14350

## 1.0.2-alpha.0

### Patch Changes

- Fixed Studio showing unauthenticated state when using `MastraJwtAuth` with custom headers. `MastraJwtAuth` now implements the `IUserProvider` interface (`getCurrentUser`/`getUser`), so the Studio capabilities endpoint can resolve the authenticated user from the JWT Bearer token. ([#14411](https://github.com/mastra-ai/mastra/pull/14411))

  Also added an optional `mapUser` option to customize how JWT claims are mapped to user fields:

  ```typescript
  new MastraJwtAuth({
    secret: process.env.JWT_SECRET,
    mapUser: payload => ({
      id: payload.userId,
      name: payload.displayName,
      email: payload.mail,
    }),
  });
  ```

  Closes #14350

## 1.0.1

### Patch Changes

- dependencies updates: ([#13134](https://github.com/mastra-ai/mastra/pull/13134))
  - Updated dependency [`jsonwebtoken@^9.0.3` ↗︎](https://www.npmjs.com/package/jsonwebtoken/v/9.0.3) (from `^9.0.2`, in `dependencies`)

- dependencies updates: ([#13135](https://github.com/mastra-ai/mastra/pull/13135))
  - Updated dependency [`jwks-rsa@^3.2.2` ↗︎](https://www.npmjs.com/package/jwks-rsa/v/3.2.2) (from `^3.2.0`, in `dependencies`)

## 1.0.1-alpha.0

### Patch Changes

- dependencies updates: ([#13134](https://github.com/mastra-ai/mastra/pull/13134))
  - Updated dependency [`jsonwebtoken@^9.0.3` ↗︎](https://www.npmjs.com/package/jsonwebtoken/v/9.0.3) (from `^9.0.2`, in `dependencies`)

- dependencies updates: ([#13135](https://github.com/mastra-ai/mastra/pull/13135))
  - Updated dependency [`jwks-rsa@^3.2.2` ↗︎](https://www.npmjs.com/package/jwks-rsa/v/3.2.2) (from `^3.2.0`, in `dependencies`)

## 1.0.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Patch Changes

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Allow provider to pass through options to the auth config ([#10284](https://github.com/mastra-ai/mastra/pull/10284))

## 1.0.0-beta.2

### Patch Changes

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

## 1.0.0-beta.1

### Patch Changes

- Allow provider to pass through options to the auth config ([#10284](https://github.com/mastra-ai/mastra/pull/10284))

## 1.0.0-beta.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

## 0.1.3

### Patch Changes

- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

## 0.1.3-alpha.0

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

## 0.1.2

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

## 0.1.1

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility

## 0.1.1-alpha.0

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
