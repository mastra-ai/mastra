# @mastra/auth-better-auth

## 1.0.0

### Minor Changes

- Add Better Auth authentication provider ([#10658](https://github.com/mastra-ai/mastra/pull/10658))

  Adds a new authentication provider for Better Auth, a self-hosted, open-source authentication framework.

  ```typescript
  import { betterAuth } from 'better-auth';
  import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
  import { Mastra } from '@mastra/core';

  // Create your Better Auth instance
  const auth = betterAuth({
    database: {
      provider: 'postgresql',
      url: process.env.DATABASE_URL!,
    },
    emailAndPassword: {
      enabled: true,
    },
  });

  // Create the Mastra auth provider
  const mastraAuth = new MastraAuthBetterAuth({
    auth,
  });

  // Use with Mastra
  const mastra = new Mastra({
    server: {
      auth: mastraAuth,
    },
  });
  ```

## 1.0.0-beta.2

### Minor Changes

- Add Better Auth authentication provider ([#10658](https://github.com/mastra-ai/mastra/pull/10658))

  Adds a new authentication provider for Better Auth, a self-hosted, open-source authentication framework.

  ```typescript
  import { betterAuth } from 'better-auth';
  import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
  import { Mastra } from '@mastra/core';

  // Create your Better Auth instance
  const auth = betterAuth({
    database: {
      provider: 'postgresql',
      url: process.env.DATABASE_URL!,
    },
    emailAndPassword: {
      enabled: true,
    },
  });

  // Create the Mastra auth provider
  const mastraAuth = new MastraAuthBetterAuth({
    auth,
  });

  // Use with Mastra
  const mastra = new Mastra({
    server: {
      auth: mastraAuth,
    },
  });
  ```

## 1.0.0-beta.1

### Major Changes

- Initial release of Better Auth integration for Mastra
- Self-hosted authentication provider using Better Auth
- Support for session-based authentication
- Custom authorization logic support
- Route configuration for public/protected paths
