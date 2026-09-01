# @mastra/auth-studio

`@mastra/auth-studio` provides authentication, organizations, and role-based access control for Studio deployments backed by the Mastra shared API. Use it when a self-hosted Studio should use Mastra's hosted identity and organization services.

## Installation

```bash
npm install @mastra/auth-studio
```

## Usage

Configure the shared API URL and organization for your Studio deployment.

```typescript
import { MastraAuthStudio } from '@mastra/auth-studio';
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    auth: new MastraAuthStudio({
      sharedApiUrl: process.env.MASTRA_SHARED_API_URL,
      organizationId: process.env.MASTRA_ORGANIZATION_ID,
    }),
  },
});
```

## Documentation

- [Studio authentication](https://mastra.ai/docs/studio/auth)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/studio/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
