# @mastra/auth-neon

Mastra authentication provider for [Neon Auth](https://neon.com/docs/auth/overview), the managed authentication service built on Better Auth.

Supports JWT bearer token verification via JWKS, session cookie verification, and email/password sign-in and sign-up for Studio.

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

## Configuration

| Option | Environment Variable | Description |
| --- | --- | --- |
| `baseUrl` | `NEON_AUTH_BASE_URL` | Neon Auth base URL (e.g., `https://your-project.neon.tech`) |
| `jwksUrl` | `NEON_AUTH_JWKS_URL` | Explicit JWKS URL (overrides `baseUrl`-derived URL) |
| `sessionCookieName` | — | Session cookie name (default: `neonauth.session_token`) |
| `signUpEnabled` | — | Whether sign-up is allowed (default: `true`) |

## Authentication flow

The adapter verifies tokens in two stages:

1. **JWT verification** — Bearer JWT tokens (e.g., Neon Auth `access_token`) are verified against the JWKS endpoint at `{baseUrl}/auth/jwks`.
2. **Session verification** — If JWT verification fails, the token is treated as a session cookie and verified via the Neon Auth REST API (`GET {baseUrl}/auth/get-session`).

## Custom Authorization

```typescript
const auth = new MastraAuthNeon({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  authorizeUser: async (user) => {
    return user.jwt?.role === 'authenticated';
  },
});
```
