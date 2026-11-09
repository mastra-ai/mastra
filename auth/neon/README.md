# @mastra/auth-neon

`@mastra/auth-neon` connects Neon Auth, the managed authentication service built on Better Auth, to Mastra. Use it when Neon manages your users and you need JWT, session-cookie, Studio sign-in, or organization-based authorization support.

## Installation

```bash
npm install @mastra/auth-neon
```

## Usage

Set `NEON_AUTH_BASE_URL` to the Neon Auth URL from the Neon Console (for example `https://ep-example-123456.neonauth.us-east-2.aws.neon.tech/neondb/auth`) before starting Mastra.

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

- [Neon integration guide](https://mastra.ai/integrations/auth/neon)
- [Neon Auth reference](https://mastra.ai/reference/auth/neon)
- [Authentication overview](https://mastra.ai/docs/auth/overview)

### Testing

`pnpm test` runs the end-to-end suite against a local Neon Auth stand-in. To run the same suite against a live Neon project, enable Neon Auth (with email and password sign-in, sign-up, and **Allow localhost** on) and set `NEON_AUTH_LIVE_BASE_URL`:

```bash
NEON_AUTH_LIVE_BASE_URL=https://ep-example-123456.neonauth.us-east-2.aws.neon.tech/neondb/auth pnpm test
```

The live run signs up throwaway `@example.com` users in that project.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/neon/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
