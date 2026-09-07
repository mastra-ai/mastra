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
      isProduction: process.env.NODE_ENV === 'production',
    }),
  },
});
```

## Documentation

`MastraCloudAuthProvider` implements Mastra's user, single sign-on, and session provider interfaces. It sends users through Mastra Cloud's PKCE authorization flow, validates the resulting session cookie, and accepts bearer tokens for API clients that do not use browser cookies.

The constructor requires the Mastra Cloud `projectId`, the `cloudBaseUrl`, and the absolute OAuth `callbackUrl` registered for the application. Set `isProduction` to add the `Secure` attribute to authentication cookies. The provider also accepts the common Mastra auth options for public and protected routes and custom user authorization.

During sign-in, the provider creates a PKCE verifier and challenge, redirects the browser to Mastra Cloud, exchanges the returned authorization code, and stores the session in an HTTP-only cookie. It exposes the login, callback, logout, session validation, and session refresh behavior required by Mastra's server authentication middleware.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/auth/cloud/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
