# @mastra/auth-workos

`@mastra/auth-workos` connects WorkOS authentication, organization memberships, and fine-grained authorization to Mastra. Use it for enterprise SSO deployments where WorkOS identities and roles should control access to Mastra resources.

## Installation

```bash
npm install @mastra/auth-workos
```

## Usage

Set `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_REDIRECT_URI`, and the cookie password required by your deployment.

```typescript
import { MastraAuthWorkos } from '@mastra/auth-workos';
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos(),
  },
});
```

## Documentation

- [WorkOS integration guide](https://mastra.ai/integrations/auth/workos)
- [WorkOS provider reference](https://mastra.ai/reference/auth/workos)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/workos/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
