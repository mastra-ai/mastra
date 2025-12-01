# @mastra/auth-better-auth

Better Auth integration for Mastra - a self-hosted, open-source authentication solution.

## Installation

```bash
npm install @mastra/auth-better-auth better-auth
```

## Usage

```typescript
import { betterAuth } from 'better-auth';
import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { Mastra } from '@mastra/core';

// Create your Better Auth instance
const auth = betterAuth({
  database: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: {
    enabled: true,
  },
});

// Create the Mastra auth provider
const mastraAuth = new MastraAuthBetterAuth({
  auth,
});

// Use with Mastra
const mastra = new Mastra({
  server: {
    auth: mastraAuth,
  },
});
```

## Configuration Options

| Option          | Type                                  | Required | Description                                                  |
| --------------- | ------------------------------------- | -------- | ------------------------------------------------------------ |
| `auth`          | `Auth`                                | Yes      | Your Better Auth instance created via `betterAuth({ ... })`  |
| `name`          | `string`                              | No       | Custom name for the auth provider (default: `'better-auth'`) |
| `authorizeUser` | `(user, request) => Promise<boolean>` | No       | Custom authorization logic                                   |
| `public`        | `string[]`                            | No       | Public routes that don't require authentication              |
| `protected`     | `string[]`                            | No       | Protected routes that require authentication                 |

## Custom Authorization

You can provide custom authorization logic:

```typescript
const mastraAuth = new MastraAuthBetterAuth({
  auth,
  async authorizeUser(user) {
    // Only allow verified emails
    return user?.user?.emailVerified === true;
  },
});
```

## Role-Based Access Control

```typescript
const mastraAuth = new MastraAuthBetterAuth({
  auth,
  async authorizeUser(user) {
    // Check for admin role (assuming you have a role field)
    const userWithRole = user?.user as any;
    return userWithRole?.role === 'admin';
  },
});
```

## Route Configuration

```typescript
const mastraAuth = new MastraAuthBetterAuth({
  auth,
  public: ['/health', '/api/status'],
  protected: ['/api/*', '/admin/*'],
});
```

## Why Better Auth?

Better Auth is a self-hosted, open-source authentication framework that gives you:

- **Full control** over your authentication system
- **No vendor lock-in** - host it yourself
- **Flexible** - works with various databases and providers
- **TypeScript-first** - full type safety
- **Plugin system** - extend with OAuth, 2FA, organizations, etc.

## Resources

- [Better Auth Documentation](https://better-auth.com)
- [Mastra Documentation](https://mastra.ai/docs)
- [GitHub Repository](https://github.com/mastra-ai/mastra)

## License

Apache-2.0
