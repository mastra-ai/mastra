# @mastra/auth-okta

Okta integration for Mastra, providing RBAC based on Okta groups and optional JWT authentication.

## Features

- 🔐 **RBAC Provider** - Map Okta groups to Mastra permissions
- 🔑 **Auth Provider** - JWT token verification using Okta's JWKS
- 🔄 **Cross-provider support** - Use with Auth0, Clerk, or any other auth provider
- ⚡ **Caching** - LRU cache for group lookups to minimize API calls
- 🛡️ **Type-safe** - Full TypeScript support with strict types

## Installation

```bash
npm install @mastra/auth-okta
# or
yarn add @mastra/auth-okta
# or
pnpm add @mastra/auth-okta
```

## Usage

### Auth0 + Okta RBAC (Recommended)

Use Auth0 for authentication and Okta for role-based access control:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthAuth0 } from '@mastra/auth-auth0';
import { MastraRBACOkta } from '@mastra/auth-okta';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthAuth0(),
    rbac: new MastraRBACOkta({
      // Extract Okta user ID from Auth0 user metadata
      getUserId: user => user.metadata?.oktaUserId || user.email,
      roleMapping: {
        Engineering: ['agents:*', 'workflows:*'],
        Product: ['agents:read', 'workflows:read'],
        Admin: ['*'],
        _default: [], // Users with unmapped groups get no permissions
      },
    }),
  },
});
```

### Full Okta Setup

For complete Okta authentication + RBAC:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthOkta, MastraRBACOkta } from '@mastra/auth-okta';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthOkta(),
    rbac: new MastraRBACOkta({
      roleMapping: {
        Admin: ['*'],
        Member: ['agents:read', 'workflows:*'],
        _default: [],
      },
    }),
  },
});
```

## Configuration

### Environment Variables

| Variable               | Description                               | Required                                           |
| ---------------------- | ----------------------------------------- | -------------------------------------------------- |
| `OKTA_DOMAIN`          | Okta domain (e.g., `dev-123456.okta.com`) | Yes                                                |
| `OKTA_CLIENT_ID`       | OAuth client ID                           | For auth only                                      |
| `OKTA_CLIENT_SECRET`   | OAuth client secret                       | For auth only                                      |
| `OKTA_REDIRECT_URI`    | OAuth redirect URI for SSO callback       | For auth only                                      |
| `OKTA_ISSUER`          | Token issuer URL                          | No (defaults to `https://{domain}/oauth2/default`) |
| `OKTA_COOKIE_PASSWORD` | Session encryption key (min 32 chars)     | No (auto-generated if omitted; set for production) |
| `OKTA_API_TOKEN`       | API token for management SDK              | For RBAC only                                      |

### MastraAuthOkta Options

```typescript
interface MastraAuthOktaOptions {
  domain?: string; // Okta domain (or OKTA_DOMAIN env var)
  clientId?: string; // OAuth client ID (or OKTA_CLIENT_ID)
  clientSecret?: string; // OAuth client secret (or OKTA_CLIENT_SECRET)
  redirectUri?: string; // SSO callback URI (or OKTA_REDIRECT_URI)
  issuer?: string; // Token issuer URL (or OKTA_ISSUER)
  scopes?: string[]; // OAuth scopes (default: ['openid', 'profile', 'email', 'groups'])
  name?: string; // Provider name (default: 'okta')
  session?: {
    cookieName?: string; // Cookie name (default: 'okta_session')
    cookieMaxAge?: number; // Cookie max age in seconds (default: 86400)
    cookiePassword?: string; // Encryption key, min 32 chars (or OKTA_COOKIE_PASSWORD)
    secureCookies?: boolean; // Set Secure flag (default: auto-detect from NODE_ENV)
  };
}
```

### MastraRBACOkta Options

```typescript
interface MastraRBACOktaOptions {
  domain?: string; // Okta domain
  apiToken?: string; // API token for group fetching

  // Map Okta groups to Mastra permissions
  roleMapping: {
    [groupName: string]: string[]; // e.g., 'Admin': ['*']
  };

  // Extract Okta user ID from any user object (for cross-provider use)
  getUserId?: (user: unknown) => string | undefined;

  // Cache configuration
  cache?: {
    maxSize?: number; // Max users to cache (default: 1000)
    ttlMs?: number; // Cache TTL in ms (default: 60000)
  };
}
```

## Role Mapping

The `roleMapping` configuration maps Okta group names to Mastra permission patterns:

```typescript
roleMapping: {
  // Users in 'Engineering' group get full access to agents and workflows
  'Engineering': ['agents:*', 'workflows:*'],

  // Users in 'Product' group get read-only access
  'Product': ['agents:read', 'workflows:read'],

  // Users in 'Admin' group get full access to everything
  'Admin': ['*'],

  // Special '_default' key: permissions for users with unmapped groups
  '_default': [],
}
```

### Permission Patterns

- `*` - Full access to all resources
- `agents:*` - Full access to agents
- `agents:read` - Read-only access to agents
- `workflows:create` - Create workflows only

## Cross-Provider Support

When using a different auth provider (Auth0, Clerk, etc.) with Okta RBAC, you need to link users between systems. The `getUserId` option allows you to extract the Okta user ID from any user object:

```typescript
new MastraRBACOkta({
  // Extract Okta user ID from Auth0 user's app_metadata
  getUserId: (user) => {
    return user.metadata?.oktaUserId || user.email;
  },
  roleMapping: { ... },
})
```

### Linking Users

To link Auth0 users to Okta:

1. Store the Okta user ID in Auth0's `app_metadata`
2. Configure `getUserId` to extract it
3. Mastra will use this ID to fetch groups from Okta

## API

### MastraRBACOkta

| Method                                 | Description                          |
| -------------------------------------- | ------------------------------------ |
| `getRoles(user)`                       | Get user's Okta groups               |
| `hasRole(user, role)`                  | Check if user has a specific group   |
| `getPermissions(user)`                 | Get resolved permissions from groups |
| `hasPermission(user, permission)`      | Check if user has a permission       |
| `hasAllPermissions(user, permissions)` | Check if user has all permissions    |
| `hasAnyPermission(user, permissions)`  | Check if user has any permission     |

### MastraAuthOkta

| Method                              | Description                 |
| ----------------------------------- | --------------------------- |
| `authenticateToken(token, request)` | Verify JWT and return user  |
| `authorizeUser(user, request)`      | Check if user is authorized |

## Requirements

- Node.js 22.13.0 or later
- Okta account with:
  - OAuth application (for authentication)
  - API token (for RBAC group fetching)
