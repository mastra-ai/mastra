# @mastra/auth-workos

A WorkOS integration for Mastra that supports authentication, role-based access control (RBAC), and Fine-Grained Authorization (FGA).

## Features

- 🔐 WorkOS authentication integration
- 👥 User management and organization membership support
- 🔑 JWT token verification using WorkOS JWKS
- 👮 Role-based authorization with `MastraRBACWorkos`
- 🔒 Fine-Grained Authorization with `MastraFGAWorkos`

## Installation

```bash
npm install @mastra/auth-workos
# or
yarn add @mastra/auth-workos
# or
pnpm add @mastra/auth-workos
```

## Usage

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthWorkos, MastraFGAWorkos } from '@mastra/auth-workos';

// Initialize with environment variables
const auth = new MastraAuthWorkos();

// Or initialize with explicit configuration
const auth = new MastraAuthWorkos({
  apiKey: 'your_workos_api_key',
  clientId: 'your_workos_client_id',
  redirectUri: 'https://your-app.com/auth/callback',
});

// Enable auth in Mastra
const mastra = new Mastra({
  ...
  server: {
    auth,
  },
});
```

`MastraAuthWorkos` authorizes any authenticated WorkOS user by default.

If you also use `MastraFGAWorkos`, set `fetchMemberships: true` so Mastra loads organization memberships during authentication:

```typescript
const auth = new MastraAuthWorkos({
  apiKey: 'your_workos_api_key',
  clientId: 'your_workos_client_id',
  redirectUri: 'https://your-app.com/auth/callback',
  fetchMemberships: true,
});

const fga = new MastraFGAWorkos({
  apiKey: 'your_workos_api_key',
  clientId: 'your_workos_client_id',
  resourceMapping: {
    thread: {
      fgaResourceType: 'workspace-thread',
      deriveId: ({ resourceId, user }) => resourceId ?? user.id,
    },
  },
  permissionMapping: {
    'memory:read': 'read',
    'memory:write': 'update',
  },
});
```

## Configuration

The package requires the following configuration:

### Environment Variables

- `WORKOS_API_KEY`: Your WorkOS API key
- `WORKOS_CLIENT_ID`: Your WorkOS client ID
- `WORKOS_REDIRECT_URI`: Your WorkOS redirect URI when you use the built-in AuthKit session flow

### Options

You can also provide these values directly when initializing the provider:

```typescript
interface MastraAuthWorkosOptions {
  apiKey?: string;
  clientId?: string;
  redirectUri?: string;
  fetchMemberships?: boolean;
}
```

## API

### `authenticateToken(token: string, request): Promise<WorkOSUser | null>`

Verifies a JWT token using WorkOS JWKS and returns the user information if valid.

### `authorizeUser(user: WorkOSUser, request): Promise<boolean>`

Authorizes an authenticated WorkOS user. By default, this returns `true` when the user has the required identifiers. Override this method in a subclass if you need stricter authorization.
