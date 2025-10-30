# @mastra/auth-supabase

A Supabase authentication integration for Mastra, providing seamless authentication and authorization capabilities using Supabase's authentication system.

## Installation

```bash
npm install @mastra/auth-supabase
# or
yarn add @mastra/auth-supabase
# or
pnpm add @mastra/auth-supabase
```

## Usage

```typescript
import { Mastra } from '@mastra/core';
import { MastraAuthSupabase } from '@mastra/auth-supabase';

// Initialize with environment variables
const auth = new MastraAuthSupabase();

// Or initialize with explicit configuration
const auth = new MastraAuthSupabase({
  url: 'your-supabase-url',
  anonKey: 'your-supabase-anon-key',
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

The package can be configured in two ways:

1. **Environment Variables**:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anonymous key

2. **Constructor Options**:
   ```typescript
   interface MastraAuthSupabaseOptions {
     url?: string;
     anonKey?: string;
   }
   ```

## Features

- **Authentication**: Verifies user tokens and retrieves user information from Supabase
- **Authorization**: Checks user permissions based on their role in Supabase
- **Type Safety**: Full TypeScript support with proper type definitions
- **Environment Variable Support**: Easy configuration through environment variables

## API

### `authenticateToken(token: string)`

Authenticates a user token and returns the user information if valid.

### `authorizeUser(user: User)`

Checks if a user has the required permissions (currently checks for admin status).

## Requirements

- Node.js 16 or higher
- Supabase project with authentication enabled
- Supabase URL and anonymous key
