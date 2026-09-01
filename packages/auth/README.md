# @mastra/auth

Authentication utilities and a JWT auth provider for Mastra servers. Use it to verify tokens and connect authenticated users to Mastra.

## Installation

```bash
npm install @mastra/auth
```

## Usage

Set `JWT_AUTH_SECRET` or pass a secret explicitly.

```typescript
import { MastraJwtAuth } from '@mastra/auth';

const auth = new MastraJwtAuth({ secret: process.env.JWT_AUTH_SECRET });
```

## Documentation

- [@mastra/auth documentation](https://mastra.ai/docs/auth/custom-auth-provider)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/auth/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
