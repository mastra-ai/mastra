# @mastra/auth-auth0

A Mastra authentication provider for Auth0 integration. This package provides seamless authentication and authorization using Auth0's JWT tokens.

## Installation

```bash
npm install @mastra/auth-auth0
# or
yarn add @mastra/auth-auth0
# or
pnpm add @mastra/auth-auth0
```

## Usage

```typescript
import { Mastra } from '@mastra/core';
import { MastraAuthAuth0 } from '@mastra/auth-auth0';

// Initialize with options
const auth0Provider = new MastraAuthAuth0({
  domain: 'your-tenant.auth0.com',
  audience: 'your-api-identifier',
});

// Or use environment variables
const auth0Provider = new MastraAuthAuth0();

// Enable auth in Mastra
const mastra = new Mastra({
  ...
  server: {
    experimental_auth: auth0Provider,
  },
});
```

## Configuration

The package can be configured either through constructor options or environment variables:

### Constructor Options

```typescript
interface MastraAuthAuth0Options {
  domain?: string; // Your Auth0 domain
  audience?: string; // Your Auth0 API identifier
}
```

### Environment Variables

- `AUTH0_DOMAIN`: Your Auth0 domain (e.g., 'your-tenant.auth0.com')
- `AUTH0_AUDIENCE`: Your Auth0 API identifier

## Features

- JWT token verification using Auth0's JWKS
- Automatic token validation against Auth0's issuer
- Audience validation
- Type-safe user payload

## Example

```typescript
import { MastraAuthAuth0 } from '@mastra/auth-auth0';

const auth0Provider = new MastraAuthAuth0({
  domain: 'your-tenant.auth0.com',
  audience: 'your-api-identifier',
});

// Authenticate a token
const user = await auth0Provider.authenticateToken('your-jwt-token');

// Authorize a user
const isAuthorized = await auth0Provider.authorizeUser(user);
```

## Requirements

- Node.js 16 or higher
- Auth0 account and configured application
- Valid Auth0 domain and API identifier
