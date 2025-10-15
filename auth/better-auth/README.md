# @mastra/auth-better-auth

Better Auth integration for Mastra.

## Installation

```bash
npm install @mastra/auth-better-auth
pnpm add @mastra/auth-better-auth
yarn add @mastra/auth-better-auth
```

## Usage

### Basic Setup

```typescript
import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { Mastra } from '@mastra/core';

// Create Better Auth provider
const authProvider = new MastraAuthBetterAuth({
  authOptions: {
    database: {
      // Your database configuration
      provider: 'pg',
      url: process.env.DATABASE_URL!,
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    },
  },
});

// Use with Mastra
const mastra = new Mastra({
  auth: {
    provider: authProvider,
  },
});
```

### Custom Session Validation

```typescript
const authProvider = new MastraAuthBetterAuth({
  authOptions: {
    // Your Better Auth config
  },
  validateSession: async (user, session) => {
    // Custom authorization logic
    // For example, check if user has specific role
    const hasAdminRole = user.role === 'admin';
    return hasAdminRole;
  },
});
```

### Server-Side Authentication

```typescript
import { headers } from 'next/headers';

// In a Next.js server component or API route
const requestHeaders = await headers();
const user = await authProvider.getSessionFromHeaders(requestHeaders);

if (user) {
  console.log('Authenticated user:', user.email);
  console.log('Session expires at:', user.session.expiresAt);
}
```

### With Express

```typescript
import express from 'express';

const app = express();

app.get('/api/protected', async (req, res) => {
  const user = await authProvider.getSessionFromHeaders(new Headers(req.headers as Record<string, string>));

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({ user });
});
```

## Configuration

### MastraAuthBetterAuthOptions

- `authOptions` (required): Better Auth configuration object. See [Better Auth documentation](https://www.better-auth.com/docs) for all options.
- `validateSession` (optional): Custom function to validate and authorize sessions.
- `name` (optional): Custom name for the auth provider (default: 'better-auth').

## Features

- Cookie-based session management
- Server-side session verification
- Custom session validation
- Support for all Better Auth features (email/password, social providers, 2FA, etc.)
- TypeScript support with full type inference

## Environment Variables

Depending on your Better Auth configuration, you may need:

```env
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# For social providers
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Notes

- Better Auth uses cookie-based sessions by default, not JWT tokens
- The `authenticateToken` method expects a session token value (without the cookie name prefix)
- For most use cases, use `getSessionFromHeaders` for server-side authentication
- Session validation happens automatically, but you can customize it with `validateSession`

## Learn More

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Mastra Documentation](https://mastra.ai/docs)
