<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase Auth JS SDK</h1>

  <h3 align="center">An isomorphic JavaScript SDK for the <a href="https://github.com/supabase/auth">Supabase Auth</a> API.</h3>

  <p align="center">
    <a href="https://supabase.com/docs/guides/auth">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript/auth-signup">Reference Docs</a>
    ·
    <a href="https://supabase.github.io/supabase-js/auth-js/v2/spec.json">TypeDoc</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/auth-js)](https://www.npmjs.com/package/@supabase/auth-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/auth-js)](https://pkg.pr.new/~/supabase/auth-js)
</div>

## Quick start

Install

```bash
npm install --save @supabase/auth-js
```

Usage

```js
import { AuthClient } from '@supabase/auth-js'

const GOTRUE_URL = 'http://localhost:9999'

const auth = new AuthClient({ url: GOTRUE_URL })
```

- `signUp()`: https://supabase.com/docs/reference/javascript/auth-signup
- `signIn()`: https://supabase.com/docs/reference/javascript/auth-signin
- `signOut()`: https://supabase.com/docs/reference/javascript/auth-signout

### Custom `fetch` implementation

`auth-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests, but an alternative `fetch` implementation can be provided as an option. This is most useful in environments where `cross-fetch` is not compatible, for instance Cloudflare Workers:

```js
import { AuthClient } from '@supabase/auth-js'

const AUTH_URL = 'http://localhost:9999'

const auth = new AuthClient({ url: AUTH_URL, fetch: fetch })
```

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

```bash
# Complete build (from monorepo root)
npx nx build auth-js

# Build with watch mode for development
npx nx build auth-js --watch

# Individual build targets
npx nx build:main auth-js    # CommonJS build (dist/main/)
npx nx build:module auth-js  # ES Modules build (dist/module/)

# Other useful commands
npx nx clean auth-js         # Clean build artifacts
npx nx format auth-js        # Format code with Prettier
npx nx lint auth-js          # Run ESLint
npx nx typecheck auth-js     # TypeScript type checking
npx nx docs auth-js          # Generate documentation
```

#### Build Outputs

- **CommonJS (`dist/main/`)** - For Node.js environments
- **ES Modules (`dist/module/`)** - For modern bundlers (Webpack, Vite, Rollup)
- **TypeScript definitions (`dist/module/index.d.ts`)** - Type definitions for TypeScript projects

### Testing

**Docker Required!** The auth-js tests require a local Supabase Auth server (GoTrue) running in Docker.

```bash
# Run complete test suite (from monorepo root)
npx nx test:auth auth-js
```

This command automatically:

1. Stops any existing test containers
2. Starts a Supabase Auth server (GoTrue) and PostgreSQL database in Docker
3. Waits for services to be ready (30 seconds)
4. Runs the test suite
5. Cleans up Docker containers after tests complete

#### Individual Test Commands

```bash
# Run just the test suite (requires infrastructure to be running)
npx nx test:suite auth-js

# Manually manage test infrastructure
npx nx test:infra auth-js   # Start Docker containers
npx nx test:clean auth-js   # Stop and remove containers
```

#### Development Testing

For actively developing and debugging tests:

```bash
# Start infrastructure once
npx nx test:infra auth-js

# Run tests multiple times (faster since containers stay up)
npx nx test:suite auth-js

# Clean up when done
npx nx test:clean auth-js
```

#### Test Infrastructure

The Docker setup includes:

- **Supabase Auth (GoTrue)** - The authentication server
- **PostgreSQL** - Database for auth data
- Pre-configured with test users and settings

#### Prerequisites

- **Docker** must be installed and running
- Ports used by test infrastructure (check `infra/docker-compose.yml`)
- No full Supabase instance needed - just the Auth server

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.