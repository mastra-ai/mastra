# @mastra/auth-cloud

Mastra Cloud authentication with PKCE OAuth. Install `@mastra/auth-cloud` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/auth-cloud
```

## Usage

Set your Mastra project ID and callback URL.

```typescript
import { MastraCloudAuthProvider } from '@mastra/auth-cloud';

const auth = new MastraCloudAuthProvider({
  projectId: process.env.MASTRA_PROJECT_ID!,
  cloudBaseUrl: 'https://cloud.mastra.ai',
  callbackUrl: 'http://localhost:4111/auth/callback',
});
```

## Documentation

- [@mastra/auth-cloud documentation](https://mastra.ai/docs/auth/custom-auth-provider)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/cloud/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
