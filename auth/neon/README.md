# @mastra/auth-neon

Mastra Neon Auth integration. Install `@mastra/auth-neon` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/auth-neon
```

## Usage

Set `NEON_AUTH_BASE_URL` or pass the Neon Auth base URL.

```typescript
import { MastraAuthNeon } from '@mastra/auth-neon';

const auth = new MastraAuthNeon({ baseUrl: process.env.NEON_AUTH_BASE_URL! });
```

## Documentation

- [@mastra/auth-neon documentation](https://mastra.ai/docs/auth/custom-auth-provider)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/neon/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
