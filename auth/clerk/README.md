# @mastra/auth-clerk

A Mastra authentication provider for Clerk, enabling seamless integration of Clerk authentication with Mastra applications.

## Installation

```bash
npm install @mastra/auth-clerk
# or
yarn add @mastra/auth-clerk
# or
pnpm add @mastra/auth-clerk
```

## Usage

```typescript
import { Mastra } from '@mastra/core';
import { MastraAuthClerk } from '@mastra/auth-clerk';

// Initialize the Clerk auth provider
const clerkAuth = new MastraAuthClerk({
  jwksUri: 'your-jwks-uri',
  secretKey: 'your-secret-key',
  publishableKey: 'your-publishable-key',
});

// Or use environment variables
const clerkAuth = new MastraAuthClerk();

// Enable auth in Mastra
const mastra = new Mastra({
  ...
  server: {
    experimental_auth: clerkAuth,
  },
});
```

## Configuration

The package can be configured either through constructor options or environment variables:

### Environment Variables

- `CLERK_JWKS_URI`: The JWKS URI for your Clerk instance
- `CLERK_SECRET_KEY`: Your Clerk secret key
- `CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key

### Constructor Options

```typescript
interface MastraAuthClerkOptions {
  jwksUri?: string;
  secretKey?: string;
  publishableKey?: string;
}
```

## Features

- JWT token verification using Clerk's JWKS
- User authentication and authorization
- Organization membership verification
- Seamless integration with Mastra's authentication system

## API

### `authenticateToken(token: string): Promise<ClerkUser | null>`

Verifies a JWT token and returns the associated user if valid.

### `authorizeUser(user: ClerkUser): Promise<boolean>`

Checks if a user is authorized by verifying their organization membership.
