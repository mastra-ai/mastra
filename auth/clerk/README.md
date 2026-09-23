# @mastra/auth-clerk

`@mastra/auth-clerk` verifies Clerk session tokens and exposes the authenticated user to Mastra's server authorization layer. Use it when your application already uses Clerk and Mastra should protect its API routes with the same users and sessions.

## Installation

```bash
npm install @mastra/auth-clerk
```

## Usage

Set `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_JWKS_URI` before starting Mastra.

```typescript
import { MastraAuthClerk } from '@mastra/auth-clerk';
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthClerk({
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
      jwksUri: process.env.CLERK_JWKS_URI,
    }),
  },
});
```

## Documentation

- [Clerk integration guide](https://mastra.ai/integrations/auth/clerk)
- [Clerk provider reference](https://mastra.ai/reference/auth/clerk)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/clerk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
