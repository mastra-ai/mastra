# @mastra/auth-neon

Mastra authentication provider for [Neon Auth](https://neon.com/docs/auth/overview), the managed authentication service built on Better Auth.

Supports JWT bearer token verification via JWKS, session cookie verification, email/password sign-in/sign-up for Studio, full session management, and optional RBAC via Neon Auth's Organization plugin.

## Installation

```bash
npm install @mastra/auth-neon
```

## Usage

```typescript
import { MastraAuthNeon } from '@mastra/auth-neon';
import { Mastra } from '@mastra/core';

const auth = new MastraAuthNeon({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
});

const mastra = new Mastra({
  server: {
    auth,
  },
});
```

### With RBAC

Neon Auth uses Better Auth's Organization plugin which provides `owner`, `admin`, and `member` roles. `MastraRBACNeon` maps these to Mastra permissions:

```typescript
import { MastraAuthNeon, MastraRBACNeon } from '@mastra/auth-neon';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthNeon({
      baseUrl: process.env.NEON_AUTH_BASE_URL,
    }),
    rbac: new MastraRBACNeon({
      roleMapping: {
        owner: ['*'],
        admin: ['*'],
        member: ['agents:read', 'workflows:*'],
        _default: [],
      },
    }),
  },
});
```

## Configuration

### Auth Provider

| Option              | Environment Variable | Description                                                 |
| ------------------- | -------------------- | ----------------------------------------------------------- |
| `baseUrl`           | `NEON_AUTH_BASE_URL` | Neon Auth base URL (e.g., `https://your-project.neon.tech`) |
| `jwksUrl`           | `NEON_AUTH_JWKS_URL` | Explicit JWKS URL (overrides `baseUrl`-derived URL)         |
| `sessionCookieName` | —                    | Session cookie name (default: `neonauth.session_token`)     |
| `signUpEnabled`     | —                    | Whether sign-up is allowed (default: `true`)                |

### RBAC Provider

| Option           | Description                                                                         |
| ---------------- | ----------------------------------------------------------------------------------- |
| `baseUrl`        | Neon Auth base URL (falls back to `NEON_AUTH_BASE_URL` env var)                     |
| `roleMapping`    | Map of role slugs to Mastra permission patterns (use `_default` for unmapped roles) |
| `organizationId` | Scope role lookups to a specific organization                                       |
| `cache.ttlMs`    | Role cache TTL in ms (default: 60000)                                               |
| `cache.maxSize`  | Max cached entries (default: 1000)                                                  |
| `getUserRoles`   | Custom function to extract roles from user (bypasses API calls)                     |

## Authentication flow

The adapter verifies tokens in two stages:

1. **JWT verification** — Bearer JWT tokens (e.g., Neon Auth `access_token`) are verified against the JWKS endpoint at `{baseUrl}/auth/jwks`.
2. **Session verification** — If JWT verification fails, the token is treated as a session cookie and verified via the Neon Auth REST API (`GET {baseUrl}/auth/get-session`).

## Implemented Interfaces

- `MastraAuthProvider` — Token authentication and authorization
- `IUserProvider` — User awareness for Studio (getCurrentUser, getUser)
- `ICredentialsProvider` — Email/password sign-in and sign-up for Studio
- `ISessionProvider` — Session management (validate, refresh, destroy, cookie handling)
- `IRBACProvider` (via `MastraRBACNeon`) — Role-based access control with permission mapping

## Custom Authorization

```typescript
const auth = new MastraAuthNeon({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  authorizeUser: async user => {
    return user.jwt?.role === 'authenticated';
  },
});
```
