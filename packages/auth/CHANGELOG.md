# @mastra/auth

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
