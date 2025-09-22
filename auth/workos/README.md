# @mastra/auth-workos

A WorkOS authentication provider for Mastra, enabling seamless integration of WorkOS authentication and authorization in your applications.

## Features

- 🔐 WorkOS authentication integration
- 👥 User management and organization membership support
- 🔑 JWT token verification using WorkOS JWKS
- 👮‍♂️ Role-based authorization with admin role support

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
import { Mastra } from '@mastra/core';
import { MastraAuthWorkos } from '@mastra/auth-workos';

// Initialize with environment variables
const auth = new MastraAuthWorkos();

// Or initialize with explicit configuration
const auth = new MastraAuthWorkos({
  apiKey: 'your_workos_api_key',
  clientId: 'your_workos_client_id',
});

// Enable auth in Mastra
const mastra = new Mastra({
  ...
  server: {
    experimental_auth: auth,
  },
});
```

## Configuration

The package requires the following configuration:

### Environment Variables

- `WORKOS_API_KEY`: Your WorkOS API key
- `WORKOS_CLIENT_ID`: Your WorkOS client ID

### Options

You can also provide these values directly when initializing the provider:

```typescript
interface MastraAuthWorkosOptions {
  apiKey?: string;
  clientId?: string;
}
```

## API

### `authenticateToken(token: string): Promise<WorkosUser | null>`

Verifies a JWT token using WorkOS JWKS and returns the user information if valid.

### `authorizeUser(user: WorkosUser): Promise<boolean>`

Checks if a user has admin privileges by verifying their organization memberships and roles.
