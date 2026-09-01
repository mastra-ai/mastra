# @mastra/auth-better-auth

Mastra Better Auth integration - self-hosted authentication. Install `@mastra/auth-better-auth` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/auth-better-auth
```

## Usage

Set `BETTER_AUTH_SECRET` or provide an existing Better Auth instance.

```typescript
import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';

const auth = new MastraAuthBetterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
});
```

## Documentation

- [@mastra/auth-better-auth documentation](https://mastra.ai/reference/auth/better-auth)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/better-auth/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
