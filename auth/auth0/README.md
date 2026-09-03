# @mastra/auth-auth0

`@mastra/auth-auth0` verifies Auth0 access tokens and makes the authenticated user available to Mastra's server authorization layer. Use it when Auth0 already issues JWTs for your application and you want Mastra endpoints protected by the same identity provider.

## Installation

```bash
npm install @mastra/auth-auth0
```

## Usage

Set `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`, or pass both values to the provider.

```typescript
import { MastraAuthAuth0 } from '@mastra/auth-auth0';
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthAuth0({
      domain: process.env.AUTH0_DOMAIN,
      audience: process.env.AUTH0_AUDIENCE,
    }),
  },
});
```

## Documentation

- [Auth0 integration guide](https://mastra.ai/integrations/auth/auth0)
- [Auth0 provider reference](https://mastra.ai/reference/auth/auth0)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/auth0/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
