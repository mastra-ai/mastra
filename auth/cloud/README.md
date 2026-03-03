# @mastra/auth-cloud

Mastra Cloud authentication provider with PKCE OAuth flow.

## Installation

```bash
pnpm add @mastra/auth-cloud
```

## Usage

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraCloudAuth } from '@mastra/auth-cloud';

const auth = new MastraCloudAuth({
  projectId: process.env.MASTRA_PROJECT_ID!,
  // Optional: defaults to https://cloud.mastra.ai
  baseUrl: process.env.MASTRA_CLOUD_URL,
  // Optional: defaults to /auth/callback
  redirectPath: '/auth/callback',
});

const mastra = new Mastra({
  server: {
    auth,
  },
});
```

## Configuration

| Option         | Required | Default                   | Description                     |
| -------------- | -------- | ------------------------- | ------------------------------- |
| `projectId`    | Yes      | -                         | Project ID from cloud.mastra.ai |
| `baseUrl`      | No       | `https://cloud.mastra.ai` | Mastra Cloud base URL           |
| `redirectPath` | No       | `/auth/callback`          | OAuth callback path             |
| `cookieName`   | No       | `mastra_session`          | Session cookie name             |

## Authentication Flow

This package implements PKCE OAuth flow with Mastra Cloud:

1. User clicks login, redirected to Mastra Cloud with code challenge
2. User authenticates via Mastra Cloud (GitHub OAuth)
3. Mastra Cloud redirects back with authorization code
4. Package exchanges code + verifier for session token
5. Session token stored in HttpOnly cookie

## API

### `MastraCloudAuth`

The main authentication provider class implementing `MastraAuthProvider`.

### Methods

- `getLoginUrl(state?)` - Get OAuth login URL with PKCE
- `handleCallback(code, verifier)` - Exchange code for session
- `verifyToken(token)` - Verify session and get user with role
- `refreshSession(token)` - Refresh expiring session
- `logout(token)` - Invalidate session

## License

Apache-2.0
