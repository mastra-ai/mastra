# @mastra/auth-auth0

## 1.1.0-alpha.0

### Minor Changes

- Added full Studio authentication support for Auth0 users. ([#16658](https://github.com/mastra-ai/mastra/pull/16658))

  **What's new:**
  - **Studio SSO login** — your internal team can now sign in to Mastra Studio using their Auth0 accounts via OAuth 2.0/OIDC
  - **JWT validation** — API requests with Auth0-issued JWTs are automatically validated
  - **Session persistence** — Studio sessions are maintained with encrypted cookies (no need to log in repeatedly)
  - **Secure logout** — proper RP-Initiated Logout support via Auth0's `/v2/logout` endpoint

  **Setup:**
  1. Create a Regular Web Application in your Auth0 Dashboard
  2. Configure the auth provider with your Auth0 credentials

  ```typescript
  import { MastraAuthAuth0 } from '@mastra/auth-auth0';

  const auth = new MastraAuthAuth0({
    domain: 'your-tenant.auth0.com',
    audience: 'https://your-api',
    // For Studio SSO login:
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    session: { cookiePassword: process.env.AUTH0_COOKIE_PASSWORD },
  });
  ```

  **Note:** This release includes updates to `@mastra/core` (ISSOProvider interface now supports async getLoginUrl) and `@mastra/server` (handles async login URLs). All three packages should be updated together.

### Patch Changes

- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd)]:
  - @mastra/core@1.43.0-alpha.0

## 1.0.1

### Patch Changes

- dependencies updates: ([#13128](https://github.com/mastra-ai/mastra/pull/13128))
  - Updated dependency [`jose@^6.1.3` ↗︎](https://www.npmjs.com/package/jose/v/6.1.3) (from `^6.1.1`, in `dependencies`)

## 1.0.1-alpha.0

### Patch Changes

- dependencies updates: ([#13128](https://github.com/mastra-ai/mastra/pull/13128))
  - Updated dependency [`jose@^6.1.3` ↗︎](https://www.npmjs.com/package/jose/v/6.1.3) (from `^6.1.1`, in `dependencies`)

## 1.0.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Experimental auth -> auth ([#9660](https://github.com/mastra-ai/mastra/pull/9660))

- This change introduces **three major breaking changes** to the Auth0 authentication provider. These updates make token verification safer, prevent server crashes, and ensure proper authorization checks. ([#10632](https://github.com/mastra-ai/mastra/pull/10632))
  - `authenticateToken()` now fails safely instead of throwing
  - Empty or invalid tokens are now rejected early
  - `authorizeUser()` now performs meaningful security checks

  These changes improve stability, prevent runtime crashes, and enforce safer authentication & authorization behavior throughout the system.

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Patch Changes

- dependencies updates: ([#10132](https://github.com/mastra-ai/mastra/pull/10132))
  - Updated dependency [`jose@^6.1.1` ↗︎](https://www.npmjs.com/package/jose/v/6.1.1) (from `^6.0.12`, in `dependencies`)

- Allow provider to pass through options to the auth config ([#10284](https://github.com/mastra-ai/mastra/pull/10284))

## 1.0.0-beta.3

### Major Changes

- This change introduces **three major breaking changes** to the Auth0 authentication provider. These updates make token verification safer, prevent server crashes, and ensure proper authorization checks. ([#10632](https://github.com/mastra-ai/mastra/pull/10632))
  - `authenticateToken()` now fails safely instead of throwing
  - Empty or invalid tokens are now rejected early
  - `authorizeUser()` now performs meaningful security checks

  These changes improve stability, prevent runtime crashes, and enforce safer authentication & authorization behavior throughout the system.

## 1.0.0-beta.2

### Patch Changes

- Allow provider to pass through options to the auth config ([#10284](https://github.com/mastra-ai/mastra/pull/10284))

## 1.0.0-beta.1

### Patch Changes

- dependencies updates: ([#10132](https://github.com/mastra-ai/mastra/pull/10132))
  - Updated dependency [`jose@^6.1.1` ↗︎](https://www.npmjs.com/package/jose/v/6.1.1) (from `^6.0.12`, in `dependencies`)

## 1.0.0-beta.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Experimental auth -> auth ([#9660](https://github.com/mastra-ai/mastra/pull/9660))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

## 0.10.5

### Patch Changes

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

## 0.10.5-alpha.0

### Patch Changes

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

## 0.10.4

### Patch Changes

- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

## 0.10.4-alpha.0

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

## 0.10.3

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

## 0.10.2

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility

## 0.10.2-alpha.0

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility

## 0.10.1

### Patch Changes

- ee857ae: dependencies updates:
  - Updated dependency [`jose@^6.0.12` ↗︎](https://www.npmjs.com/package/jose/v/6.0.12) (from `^6.0.11`, in `dependencies`)

## 0.10.1-alpha.0

### Patch Changes

- ee857ae: dependencies updates:
  - Updated dependency [`jose@^6.0.12` ↗︎](https://www.npmjs.com/package/jose/v/6.0.12) (from `^6.0.11`, in `dependencies`)
