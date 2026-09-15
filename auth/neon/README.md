# @mastra/auth-neon

`@mastra/auth-neon` connects Neon Auth, the managed authentication service built on Better Auth, to Mastra. Use it when Neon manages your users and you need JWT, session-cookie, Studio sign-in, or organization-based authorization support.

## Installation

```bash
npm install @mastra/auth-neon
```

## Usage

Set `NEON_AUTH_BASE_URL` before starting Mastra.

```typescript
import { MastraAuthNeon } from '@mastra/auth-neon';
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthNeon({
      baseUrl: process.env.NEON_AUTH_BASE_URL,
    }),
  },
});
```

## Documentation

- [Neon Auth reference](https://mastra.ai/reference/auth/neon)
- [Authentication overview](https://mastra.ai/docs/auth/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/neon/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
