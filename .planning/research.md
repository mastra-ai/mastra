# Research: auth-rbac-feature Branch

> Research Date: 2026-01-29
> Branch: auth-rbac-feature
> Commits: 177 ahead of main

## Executive Summary

The `auth-rbac-feature` branch implements a comprehensive Enterprise Edition (EE) authentication and Role-Based Access Control (RBAC) system for the Mastra framework. This is a foundational feature that enables:

1. **User Authentication** - Multiple providers (Cloud, WorkOS, SimpleAuth)
2. **Session Management** - Cookie-based and JWT sessions
3. **Role-Based Access Control** - Granular permissions with wildcards
4. **Access Control Lists** - Resource-level permissions (interfaces only)
5. **SSO Integration** - OAuth/OIDC flows with external providers
6. **Playground UI** - Full auth UI in Mastra Studio

---

## Architecture Overview

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     Mastra Instance                          │
│  server: { auth: MastraAuthProvider }                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  EE Interfaces (core/ee)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ IUserProvider│ │ISSOProvider  │ │IRBACProvider │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ISessionProv. │ │ICredentials  │ │ IACLProvider │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  MastraCloud    │  │   WorkOS        │  │  SimpleAuth     │
│  Auth Provider  │  │  Auth Provider  │  │  (Dev/Test)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Package Structure

```
auth/
├── cloud/                    # NEW - Mastra Cloud auth plugin
│   ├── src/client.ts         # HTTP transport layer
│   └── src/index.ts          # Auth provider implementation
├── workos/                   # UPDATED - Full rewrite
│   ├── src/auth-provider.ts  # Main auth provider
│   ├── src/rbac-provider.ts  # Role mapping provider
│   ├── src/directory-sync.ts # SCIM webhook handler
│   ├── src/admin-portal.ts   # Self-service portal
│   └── src/session-storage.ts
├── better-auth/              # Updated interfaces
├── auth0/                    # Updated interfaces
├── clerk/                    # Updated interfaces
├── firebase/                 # Updated interfaces
└── supabase/                 # Updated interfaces

packages/
├── core/src/ee/              # NEW - EE interfaces & defaults
│   ├── interfaces/           # All interface definitions
│   ├── defaults/             # Default implementations
│   ├── capabilities.ts       # Capability detection
│   ├── license.ts            # License validation
│   └── with-ee.ts            # EE wrapper function
├── core/src/server/
│   ├── auth.ts               # Base auth provider
│   └── simple-auth.ts        # NEW - Dev/test auth
├── server/                   # Auth integration
│   └── src/server/auth/      # Auth helpers & middleware
├── playground-ui/            # Auth UI components
│   └── src/domains/auth/     # Login, user menu, permissions

server-adapters/
├── hono/                     # Updated for cookie auth
├── express/                  # Updated for cookie auth
├── fastify/                  # Updated for cookie auth
└── koa/                      # Updated for cookie auth
```

---

## Core EE Interfaces

### IUserProvider<TUser>

Provides user awareness in Studio.

```typescript
interface IUserProvider<TUser extends EEUser = EEUser> {
  getCurrentUser(request: Request): Promise<TUser | null>;
  getUser(userId: string): Promise<TUser | null>;
  getUserProfileUrl?(user: TUser): string;
}

interface EEUser {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}
```

### ISessionProvider<TSession>

Manages session lifecycle.

```typescript
interface ISessionProvider<TSession extends Session = Session> {
  createSession(userId: string, metadata?: Record<string, unknown>): Promise<TSession>;
  validateSession(sessionId: string): Promise<TSession | null>;
  destroySession(sessionId: string): Promise<void>;
  refreshSession(sessionId: string): Promise<TSession | null>;
  getSessionIdFromRequest(request: Request): string | null;
  getSessionHeaders(session: TSession): Record<string, string>;
  getClearSessionHeaders(): Record<string, string>;
}
```

### ISSOProvider<TUser>

Handles OAuth/OIDC flows.

```typescript
interface ISSOProvider<TUser = unknown> {
  getLoginUrl(redirectUri: string, state: string): string;
  handleCallback(code: string, state: string): Promise<SSOCallbackResult<TUser>>;
  getLogoutUrl?(redirectUri: string, request?: Request): string | null | Promise<string | null>;
  getLoginButtonConfig(): SSOLoginConfig;
}
```

### IRBACProvider<TUser>

Role-based access control.

```typescript
interface IRBACProvider<TUser = unknown> {
  roleMapping?: RoleMapping;
  getRoles(user: TUser): Promise<string[]>;
  hasRole(user: TUser, role: string): Promise<boolean>;
  getPermissions(user: TUser): Promise<string[]>;
  hasPermission(user: TUser, permission: string): Promise<boolean>;
  hasAllPermissions(user: TUser, permissions: string[]): Promise<boolean>;
  hasAnyPermission(user: TUser, permissions: string[]): Promise<boolean>;
}
```

### IACLProvider<TUser>

Resource-level access control (interface only, no default implementation).

```typescript
interface IACLProvider<TUser = unknown> {
  canAccess(user: TUser, resource: ResourceIdentifier, action: string): Promise<boolean>;
  listAccessible(user: TUser, resourceType: string, action: string): Promise<string[]>;
  filterAccessible<T extends { id: string }>(
    user: TUser,
    resources: T[],
    resourceType: string,
    action: string,
  ): Promise<T[]>;
}
```

---

## Permission System

### Format

```
{resource}:{action}[:{resource-id}]
```

### Wildcard Matching

| User Permission        | Required Check         | Result     |
| ---------------------- | ---------------------- | ---------- |
| `*`                    | anything               | ✓ Match    |
| `agents:*`             | `agents:read`          | ✓ Match    |
| `agents:*`             | `workflows:read`       | ✗ No match |
| `agents:read`          | `agents:read:my-agent` | ✓ Match    |
| `agents:read:specific` | `agents:read:other`    | ✗ No match |

### Default Roles

```typescript
const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    name: 'Owner',
    permissions: ['*'], // Full access
  },
  {
    id: 'admin',
    name: 'Admin',
    permissions: [
      'studio:*',
      'agents:*',
      'workflows:*',
      'memory:*',
      'tools:*',
      'logs:read',
      'users:read',
      'users:invite',
      'settings:read',
      'settings:write',
    ],
  },
  {
    id: 'member',
    name: 'Member',
    permissions: [
      'studio:read',
      'studio:execute',
      'agents:read',
      'agents:execute',
      'workflows:read',
      'workflows:execute',
      'memory:read',
      'tools:read',
      'logs:read',
    ],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    permissions: ['studio:read', 'agents:read', 'workflows:read', 'logs:read'],
  },
];
```

### All Studio Permissions

```
studio:read, studio:write, studio:execute, studio:admin
agents:read, agents:write, agents:execute, agents:delete
workflows:read, workflows:write, workflows:execute, workflows:delete
memory:read, memory:write, memory:delete
tools:read, tools:write, tools:delete
logs:read, logs:delete
users:read, users:write, users:invite, users:delete
settings:read, settings:write
```

---

## Auth Provider Implementations

### 1. MastraCloudAuth (auth/cloud)

Zero-config auth powered by Mastra Cloud. Free for all users.

**Features:**

- JWT-based sessions (no server-side storage)
- Local JWT decoding (no API calls for user info)
- License bypass via `isMastraCloudAuth = true` marker

**Flow:**

```
1. User clicks "Sign in with Mastra"
2. Redirect to cloud.mastra.ai/auth/oss
3. User authenticates
4. Callback with authorization code
5. Exchange code for JWT
6. JWT stored in cookie as session
7. JWT decoded locally for user info
```

**Configuration:**

```typescript
const auth = new MastraCloudAuth({
  projectId: process.env.MASTRA_PROJECT_ID!,
  baseUrl: 'https://cloud.mastra.ai', // Optional
  cookieName: 'mastra_session', // Optional
});
```

### 2. MastraAuthWorkos (auth/workos)

Enterprise SSO via WorkOS AuthKit.

**Features:**

- AuthKit session management (encrypted cookies)
- SAML/OIDC SSO
- Directory sync (SCIM)
- Admin portal self-service
- 60-second permission caching

**Flow:**

```
1. User clicks "Sign in"
2. Redirect to WorkOS AuthKit
3. User authenticates via SSO/email
4. Callback with session
5. Encrypted cookie set
6. AuthKit validates session on requests
7. JWT fallback for bearer tokens
```

**Configuration:**

```typescript
const workosAuth = new MastraAuthWorkos({
  apiKey: process.env.WORKOS_API_KEY,
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://app.example.com/auth/callback',
  session: {
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD, // >= 32 chars
    cookieName: 'wos_session',
    maxAge: 60 * 60 * 24 * 400, // 400 days
    secure: true,
    sameSite: 'Lax',
  },
  sso: {
    // One of: connection, provider, defaultOrganization, or none (AuthKit)
    provider: 'GoogleOAuth',
  },
});

const rbac = new MastraRBACWorkos({
  workos: workosAuth.getWorkOS(),
  roleMapping: {
    admin: ['*'],
    member: ['agents:*', 'workflows:*'],
    viewer: ['agents:read', 'workflows:read'],
    _default: [],
  },
});
```

### 3. SimpleAuth (core/server)

Development/testing auth with pre-configured tokens.

**Features:**

- Token-to-user mapping
- Cookie-based sessions
- License bypass via `isSimpleAuth = true` marker

**Configuration:**

```typescript
const auth = new SimpleAuth({
  tokens: {
    'dev-token-123': { id: 'user-1', email: 'dev@example.com', name: 'Developer' },
    'admin-token': { id: 'user-2', email: 'admin@example.com', name: 'Admin' },
  },
});
```

---

## Server Integration

### Authentication Flow

```
Request
   │
   ▼
┌─────────────────────┐
│  Server Adapter     │ (Hono/Express/Fastify/Koa)
│  toWebRequest()     │
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│  Auth Middleware    │
│  - isDevPlayground? │
│  - isProtectedPath? │
│  - getToken()       │
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│  authenticateToken  │
│  - Cookie auth      │
│  - Bearer token     │
│  - API key          │
└─────────────────────┘
   │
   ▼
┌─────────────────────┐
│  Request Context    │
│  user: {...}        │
│  permissions: [...]  │
└─────────────────────┘
   │
   ▼
Route Handler
```

### Recent Fix: Cookie-Based Auth

Commit `f53d21cac1` fixed a regression where cookie-based auth providers couldn't read session cookies.

**Problem:** `checkRouteAuth` passed `null` instead of `Request` to `authenticateToken`.

**Solution:** All server adapters now:

1. Convert native request to Web API Request
2. Pass request to `authenticateToken`
3. Provider reads cookies from request

---

## Playground UI

### Components

```
src/domains/auth/
├── components/
│   ├── auth-required.tsx    # Protected route wrapper
│   ├── auth-status.tsx      # Loading/error states
│   ├── login-button.tsx     # SSO/credentials button
│   ├── login-page.tsx       # Full login page
│   ├── user-avatar.tsx      # User avatar display
│   └── user-menu.tsx        # Dropdown with logout
├── hooks/
│   ├── use-auth-capabilities.ts  # Fetch auth config
│   ├── use-auth-actions.ts       # Login/logout actions
│   ├── use-credentials-login.ts  # Email/password login
│   ├── use-credentials-signup.ts # Registration
│   ├── use-current-user.ts       # Get authenticated user
│   └── use-permissions.ts        # Check permissions
├── types.ts                 # Auth type definitions
└── index.ts                 # Exports
```

### Auth Capabilities Response

```typescript
// Unauthenticated
{
  enabled: true,
  login: {
    type: 'sso',
    sso: { provider: 'mastra', text: 'Sign in with Mastra', url: '...' }
  }
}

// Authenticated
{
  enabled: true,
  login: { type: 'sso', sso: {...} },
  user: { id: '...', email: '...', name: '...', avatarUrl: '...' },
  capabilities: {
    user: true,
    session: true,
    sso: true,
    rbac: true,
    acl: false
  },
  access: {
    roles: ['admin'],
    permissions: ['studio:*', 'agents:*', ...]
  }
}
```

---

## License System

### How It Works

1. License key from `MASTRA_EE_LICENSE` env var
2. 1-minute cache for performance
3. Currently validates: key length >= 32 chars
4. TODO: Proper cryptographic validation

### License Bypass

These providers work without a license:

- `MastraCloudAuth` (`isMastraCloudAuth = true`)
- `SimpleAuth` (`isSimpleAuth = true`)

---

## Testing

### Test Files

| Package     | Test File        | Coverage         |
| ----------- | ---------------- | ---------------- |
| auth/cloud  | client.test.ts   | Transport layer  |
| auth/cloud  | index.test.ts    | Provider methods |
| auth/workos | index.test.ts    | Auth flows       |
| e2e-tests   | workspace-compat | E2E integration  |

### Running Tests

```bash
# Auth cloud tests
cd auth/cloud && pnpm test

# Auth workos tests
cd auth/workos && pnpm test

# E2E tests
cd e2e-tests/workspace-compat && pnpm test
```

---

## Configuration Examples

### Mastra with Cloud Auth

```typescript
import { Mastra } from '@mastra/core';
import { MastraCloudAuth } from '@mastra/auth-cloud';

const mastra = new Mastra({
  server: {
    auth: new MastraCloudAuth({
      projectId: process.env.MASTRA_PROJECT_ID!,
    }),
  },
});
```

### Mastra with WorkOS Auth + RBAC

```typescript
import { Mastra } from '@mastra/core';
import { MastraAuthWorkos, MastraRBACWorkos } from '@mastra/auth-workos';

const workosAuth = new MastraAuthWorkos({
  apiKey: process.env.WORKOS_API_KEY!,
  clientId: process.env.WORKOS_CLIENT_ID!,
  redirectUri: process.env.WORKOS_REDIRECT_URI!,
  session: { cookiePassword: process.env.WORKOS_COOKIE_PASSWORD! },
});

const mastra = new Mastra({
  server: {
    auth: workosAuth,
    rbac: new MastraRBACWorkos({
      workos: workosAuth.getWorkOS(),
      roleMapping: {
        Engineering: ['agents:*', 'workflows:*'],
        Product: ['agents:read', 'workflows:read'],
        _default: [],
      },
    }),
  },
});
```

### Mastra with SimpleAuth (Development)

```typescript
import { Mastra } from '@mastra/core';
import { SimpleAuth } from '@mastra/core/server';

const mastra = new Mastra({
  server: {
    auth: new SimpleAuth({
      tokens: {
        'dev-token': { id: 'dev-user', email: 'dev@local', name: 'Developer' },
      },
    }),
  },
});
```

---

## API Endpoints

### Auth Routes

| Method | Path                           | Description            |
| ------ | ------------------------------ | ---------------------- |
| GET    | `/api/auth/capabilities`       | Get auth config & user |
| GET    | `/api/auth/login`              | Redirect to SSO        |
| GET    | `/api/auth/callback`           | SSO callback           |
| POST   | `/api/auth/credentials/signin` | Email/password login   |
| POST   | `/api/auth/credentials/signup` | Registration           |
| POST   | `/api/auth/logout`             | Logout user            |

### Protected Routes (Examples)

| Method | Path                     | Required Permission |
| ------ | ------------------------ | ------------------- |
| GET    | `/api/agents`            | `agents:read`       |
| POST   | `/api/agents/:id/run`    | `agents:execute`    |
| DELETE | `/api/agents/:id`        | `agents:delete`     |
| GET    | `/api/workflows`         | `workflows:read`    |
| POST   | `/api/workflows/:id/run` | `workflows:execute` |

---

## Migration Considerations

### For Existing Users

1. **No auth configured** → Works as before (no breaking change)
2. **Custom auth** → May need to update for new interfaces
3. **WorkOS users** → Need to update to new provider API

### Breaking Changes

1. `authenticateToken(token)` → `authenticateToken(token, request)`
2. WorkOS config structure changed
3. RBAC moved from auth provider to separate provider

---

## Future Considerations

1. **ACL Implementation** - Interface exists, no default implementation
2. **License Validation** - Proper cryptographic validation pending
3. **Multi-tenancy** - Organization-scoped permissions
4. **Audit Logging** - Structured auth event logging
5. **Token Rotation** - Automatic refresh token handling
