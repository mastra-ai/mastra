# @mastra/auth

Design secure identity flows for Mastra that protect endpoints and carry trusted user context through agents and tools while enforcing data boundaries.

## Installation

```bash
npm install @mastra/auth
```

## Usage

Set `JWT_AUTH_SECRET` or pass a secret explicitly.

```typescript
import { MastraJwtAuth } from '@mastra/auth';
import { Mastra } from '@mastra/core/mastra';

const auth = new MastraJwtAuth({ secret: process.env.JWT_AUTH_SECRET });

export const mastra = new Mastra({
  server: { auth },
});
```

## Documentation

- [Authentication and identity](https://mastra.ai/docs/guides/authentication-identity)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/auth/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
