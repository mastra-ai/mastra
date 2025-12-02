<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase PostgREST JS SDK</h1>

  <h3 align="center">Isomorphic JavaScript SDK for <a href="https://postgrest.org">PostgREST</a> with an ORM-like interface.</h3>

  <p align="center">
    <a href="https://supabase.com/docs/guides/database">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript/select">Reference Docs</a>
    ·
    <a href="https://supabase.github.io/supabase-js/postgrest-js/v2/spec.json">TypeDoc</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/postgrest-js)](https://www.npmjs.com/package/@supabase/postgrest-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/postgrest-js)](https://pkg.pr.new/~/supabase/postgrest-js)

</div>

### Quick start

Install

```bash
npm install @supabase/postgrest-js
```

Usage

```js
import { PostgrestClient } from '@supabase/postgrest-js'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient(REST_URL)
```

- select(): https://supabase.com/docs/reference/javascript/select
- insert(): https://supabase.com/docs/reference/javascript/insert
- update(): https://supabase.com/docs/reference/javascript/update
- delete(): https://supabase.com/docs/reference/javascript/delete

#### Custom `fetch` implementation

`postgrest-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests, but an alternative `fetch` implementation can be provided as an option. This is most useful in environments where `cross-fetch` is not compatible, for instance Cloudflare Workers:

```js
import { PostgrestClient } from '@supabase/postgrest-js'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient(REST_URL, {
  fetch: (...args) => fetch(...args),
})
```

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

```bash
# Complete build (from monorepo root)
npx nx build postgrest-js

# Build with watch mode for development
npx nx build postgrest-js --watch

# Individual build targets
npx nx build:cjs postgrest-js   # CommonJS build
npx nx build:esm postgrest-js   # ES Modules wrapper

# Other useful commands
npx nx clean postgrest-js       # Clean build artifacts
npx nx format postgrest-js      # Format code with Prettier
npx nx lint postgrest-js        # Run ESLint
npx nx type-check postgrest-js  # TypeScript type checking
npx nx docs postgrest-js        # Generate documentation
```

#### Build Outputs

- **CommonJS (`dist/cjs/`)** - For Node.js environments
  - `index.js` - Main entry point
  - `index.d.ts` - TypeScript definitions
- **ES Modules (`dist/esm/`)** - For modern bundlers
  - `wrapper.mjs` - ESM wrapper that imports CommonJS

#### Special Build Setup

Unlike other packages, postgrest-js uses a hybrid approach:

- The main code is compiled to CommonJS
- An ESM wrapper (`wrapper.mjs`) is provided for ES Module environments
- This ensures maximum compatibility across different JavaScript environments

The `wrapper.mjs` file simply re-exports the CommonJS build, allowing the package to work seamlessly in both CommonJS and ESM contexts.

### Testing

**Docker Required!** The postgrest-js tests need a local PostgreSQL database and PostgREST server running in Docker containers.

#### Quick Start

```bash
# Run all tests (from monorepo root)
npx nx test postgrest-js
```

This single command automatically:

1. Cleans any existing test containers
2. Starts PostgreSQL database and PostgREST server in Docker
3. Waits for services to be ready
4. Runs format checking
5. Runs TypeScript type tests
6. Generates and validates TypeScript types from the database schema
7. Runs all Jest unit tests with coverage
8. Runs CommonJS and ESM smoke tests
9. Cleans up Docker containers

#### Individual Test Commands

```bash
# Run tests with coverage
npx nx test:run postgrest-js

# Update test snapshots and regenerate types
npx nx test:update postgrest-js

# Type checking only
npx nx test:types postgrest-js

```

#### Test Infrastructure

The tests use Docker Compose to spin up:

- **PostgreSQL** - Database with test schema and dummy data
- **PostgREST** - REST API server that the client connects to

```bash
# Manually manage test infrastructure
npx nx db:run postgrest-js     # Start containers
npx nx db:clean postgrest-js   # Stop and remove containers
```

#### What `test:update` Does

The `test:update` command is useful when:

- Database schema changes require updating TypeScript types
- Test snapshots need to be updated after intentional changes

It performs these steps:

1. Starts fresh database containers
2. **Regenerates TypeScript types** from the actual database schema
3. **Updates Jest snapshots** for all tests
4. Cleans up containers

#### Test Types Explained

- **Format Check** - Ensures code formatting with Prettier
- **Type Tests** - Validates TypeScript types using `tstyche`
- **Generated Types Test** - Ensures generated types match database schema
- **Unit Tests** - Jest tests covering all client functionality
- **Smoke Tests** - Basic import/require tests for CommonJS and ESM

#### Prerequisites

- **Docker** must be installed and running
- **Port 3000** - PostgREST server (API)
- **Port 8080** - Database schema endpoint (for type generation)

**Note:** Unlike a full Supabase instance, this uses a minimal PostgREST setup specifically for testing the SDK.

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.

## License

This repo is licensed under MIT License.