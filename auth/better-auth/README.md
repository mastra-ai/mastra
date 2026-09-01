# @mastra/auth-better-auth

`@mastra/auth-better-auth` connects a Better Auth instance to Mastra's server authentication layer. Use it when you want a self-hosted, TypeScript-first authentication system that you control instead of relying on a hosted identity provider.

## Installation

```bash
npm install @mastra/auth-better-auth
npm install better-auth
```

## Usage

Create a Better Auth instance with your database configuration, then register its Mastra adapter under `server.auth`.

```typescript
import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { Mastra } from '@mastra/core/mastra';
import { betterAuth } from 'better-auth';

const auth = betterAuth({
  database: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: {
    enabled: true,
  },
});

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthBetterAuth({ auth }),
  },
});
```

## Documentation

- [Better Auth integration guide](https://mastra.ai/integrations/auth/better-auth)
- [Better Auth provider reference](https://mastra.ai/reference/auth/better-auth)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/better-auth/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
