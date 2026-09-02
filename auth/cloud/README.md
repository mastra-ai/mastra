# @mastra/auth-cloud

`@mastra/auth-cloud` authenticates users through Mastra Cloud with a Proof Key for Code Exchange (PKCE) OAuth flow. Use it when a self-hosted Mastra server should delegate sign-in and session management to a Mastra Cloud project.

## Installation

```bash
npm install @mastra/auth-cloud
```

## Usage

Set `MASTRA_PROJECT_ID` before starting Mastra.

```typescript
import { MastraCloudAuthProvider } from '@mastra/auth-cloud';
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  server: {
    auth: new MastraCloudAuthProvider({
      projectId: process.env.MASTRA_PROJECT_ID!,
      cloudBaseUrl: 'https://cloud.mastra.ai',
      callbackUrl: 'https://example.com/auth/callback',
    }),
  },
});
```

## Documentation

This README is the package guide. `MastraCloudAuthProvider` uses Mastra Cloud's PKCE sign-in flow, validates the resulting session cookie, and exposes user, SSO, and session capabilities through Mastra's server auth interface.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/cloud/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
