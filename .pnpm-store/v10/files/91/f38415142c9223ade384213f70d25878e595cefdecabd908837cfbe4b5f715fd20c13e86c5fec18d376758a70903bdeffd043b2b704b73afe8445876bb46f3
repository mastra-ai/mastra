<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase JS SDK</h1>

  <h3 align="center">Isomorphic JavaScript SDK for Supabase - combining Auth, Database, Storage, Functions, and Realtime.</h3>

  <p align="center">
    <a href="https://supabase.com/docs/guides/getting-started">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript/start">Reference Docs</a>
    ·
    <a href="https://supabase.github.io/supabase-js/supabase-js/v2/spec.json">TypeDoc</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/supabase-js)](https://www.npmjs.com/package/@supabase/supabase-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/supabase-js)](https://pkg.pr.new/~/supabase/supabase-js)

</div>

## Usage

First of all, you need to install the library:

```sh
npm install @supabase/supabase-js
```

Then you're able to import the library and establish the connection with the database:

```js
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
```

### UMD

You can use plain `<script>`s to import supabase-js from CDNs, like:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

or even:

```html
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
```

Then you can use it from a global `supabase` variable:

```html
<script>
  const { createClient } = supabase
  const _supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')

  console.log('Supabase Instance: ', _supabase)
  // ...
</script>
```

### ESM

You can use `<script type="module">` to import supabase-js from CDNs, like:

```html
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
  const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')

  console.log('Supabase Instance: ', supabase)
  // ...
</script>
```

### Deno

You can use supabase-js in the Deno runtime via [JSR](https://jsr.io/@supabase/supabase-js):

```js
import { createClient } from 'jsr:@supabase/supabase-js@2'
```

### Custom `fetch` implementation

`supabase-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests, but an alternative `fetch` implementation can be provided as an option. This is most useful in environments where `cross-fetch` is not compatible, for instance Cloudflare Workers:

```js
import { createClient } from '@supabase/supabase-js'

// Provide a custom `fetch` implementation as an option
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key', {
  global: {
    fetch: (...args) => fetch(...args),
  },
})
```

## Support Policy

This section outlines the scope of support for various runtime environments in Supabase JavaScript client.

### Node.js

We only support Node.js versions that are in **Active LTS** or **Maintenance** status as defined by the [official Node.js release schedule](https://nodejs.org/en/about/previous-releases#release-schedule). This means we support versions that are currently receiving long-term support and critical bug fixes.

When a Node.js version reaches end-of-life and is no longer in Active LTS or Maintenance status, Supabase will drop it in a **minor release**, and **this won't be considered a breaking change**.

### Deno

We support Deno versions that are currently receiving active development and security updates. We follow the [official Deno release schedule](https://docs.deno.com/runtime/fundamentals/stability_and_releases/) and only support versions from the `stable` and `lts` release channels.

When a Deno version reaches end-of-life and is no longer receiving security updates, Supabase will drop it in a **minor release**, and **this won't be considered a breaking change**.

### Important Notes

- **Experimental features**: Features marked as experimental may be removed or changed without notice

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

```bash
# From the monorepo root
npx nx build supabase-js

# Or with watch mode for development
npx nx build supabase-js --watch
```

### Testing

**Important:** The test suite includes tests for multiple runtime environments (Node.js, Deno, Bun, Expo, Next.js). Each environment has its own test runner and specific requirements.

#### Prerequisites for All Integration Tests

1. **Docker** must be installed and running
2. **Supabase CLI** must be installed (`npm install -g supabase` or via package manager)
3. **Local Supabase instance** must be started:

```bash
# Navigate to the supabase-js package directory
cd packages/core/supabase-js

# Start Supabase (downloads and starts all required containers)
npx supabase start

# The output will show:
# - API URL: http://127.0.0.1:54321
# - Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
# - Studio URL: http://127.0.0.1:54323
# - Anon key: [your-anon-key]
# - Service role key: [your-service-role-key]  # Important for some tests!

# Return to monorepo root for running tests
cd ../../..
```

#### Test Scripts Overview

| Script                     | Description                               | Requirements                            |
| -------------------------- | ----------------------------------------- | --------------------------------------- |
| `test`                     | Runs unit tests + type checking           | None                                    |
| `test:all`                 | Unit + integration + browser tests        | Supabase running                        |
| `test:run`                 | Jest unit tests only                      | None                                    |
| `test:unit`                | Jest unit tests in test/unit directory    | None                                    |
| `test:coverage`            | Unit tests with coverage report           | None                                    |
| `test:integration`         | Node.js integration tests                 | Supabase running + SERVICE_ROLE_KEY     |
| `test:integration:browser` | Browser tests using Deno + Puppeteer      | Supabase running + Deno installed       |
| `test:edge-functions`      | Edge Functions tests                      | Supabase running + Deno installed       |
| `test:types`               | TypeScript type checking + JSR validation | None                                    |
| `test:bun`                 | Bun runtime compatibility tests           | Supabase running + Bun installed        |
| `test:node:playwright`     | WebSocket browser tests                   | Supabase running + Playwright           |
| Deno (see section below)   | Deno runtime compatibility tests          | Supabase running + Deno installed       |
| Expo (see section below)   | React Native/Expo tests                   | Supabase running + dependencies updated |
| Next.js (see below)        | Next.js SSR tests                         | Supabase running + dependencies updated |

#### Unit Testing

```bash
# Run all unit tests (Jest)
npx nx test supabase-js

# Run only unit tests in test/unit directory
npx nx test:unit supabase-js

# Run tests in watch mode during development
npx nx test supabase-js --watch

# Run tests with coverage report
npx nx test:coverage supabase-js
```

#### Integration Testing

```bash
# Prerequisites: Start Supabase first (see above)

# Run Node.js integration tests
# IMPORTANT: Requires SUPABASE_SERVICE_ROLE_KEY environment variable
cd packages/core/supabase-js
export SUPABASE_SERVICE_ROLE_KEY="$(npx supabase status --output json | jq -r '.SERVICE_ROLE_KEY')"
cd ../../..
npx nx test:integration supabase-js

# Run browser-based integration tests (requires Deno)
npx nx test:integration:browser supabase-js
```

#### Running All Tests

```bash
# This runs type checking, unit tests, and integration tests sequentially
# NOTE: Will fail if Supabase is not running or dependencies not updated
npx nx test:all supabase-js
```

**Common Issues and Solutions:**

| Issue                                        | Solution                                                        |
| -------------------------------------------- | --------------------------------------------------------------- |
| "Cannot find module 'https://deno.land/...'" | Deno tests incorrectly run by Jest - check `jest.config.ts`     |
| "Port 54322 already allocated"               | Stop existing Supabase: `npx supabase stop --project-id <name>` |
| "503 Service Unavailable" for Edge Functions | Supabase not running - start with `npx supabase start`          |
| "Uncommitted changes" during type check      | Commit changes or add `--allow-dirty` to JSR publish            |
| Integration tests fail with auth errors      | Export `SUPABASE_SERVICE_ROLE_KEY` (see Integration Testing)    |

### Platform-Specific Testing

#### Expo Testing (React Native)

```bash
# Prerequisites:
# 1. Supabase must be running (see Prerequisites)
# 2. Update test dependencies and pack current build
cd packages/core/supabase-js
npm run update:test-deps:expo

# Run Expo tests from the Expo test project
cd test/integration/expo
npm install
npm test
cd ../../..
```

#### Next.js Testing (SSR)

```bash
# Prerequisites:
# 1. Supabase must be running (see Prerequisites)
# 2. Update test dependencies and pack current build
npx nx update:test-deps:next supabase-js

# 3. Install Playwright browsers and dependencies
npx playwright install --with-deps

# Run Next.js tests from the Next test project
cd packages/core/supabase-js/test/integration/next
npm install --legacy-peer-deps
npm run test
cd ../../..
```

#### Deno Testing

```bash
# Prerequisites:
# 1. Deno must be installed (https://deno.land)
# 2. Supabase must be running (see Prerequisites)
# 3. Update test dependencies:
npx nx update:test-deps:deno supabase-js

# Run Deno tests
npx nx test:deno supabase-js
```

### Edge Functions Testing

The project includes Edge Functions integration tests that require a local Supabase instance to be running.

```bash
# Prerequisites:
# 1. Ensure Docker is installed and running
# 2. Navigate to the supabase-js package directory
cd packages/core/supabase-js

# 3. Start Supabase locally (this will download and start all required containers)
npx supabase start

# Wait for the output showing all services are ready, including:
# - API URL: http://127.0.0.1:54321
# - Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
# - Edge Runtime container

# 4. Run the Edge Functions tests from the monorepo root
cd ../../../  # Back to monorepo root
npx nx test:edge-functions supabase-js
```

**Important Notes:**

- The Edge Functions tests will fail with 503 errors if Supabase is not running
- If you encounter port conflicts (e.g., "port 54322 already allocated"), stop any existing Supabase instances:

  ```bash
  npx supabase stop --project-id <project-name>
  # Or stop all Docker containers if unsure:
  docker ps | grep supabase  # List all Supabase containers
  ```

- The tests use the default local development credentials (anon key)
- Edge Functions are automatically served when `supabase start` is run

#### Bun Testing

```bash
# Prerequisites:
# 1. Bun must be installed (https://bun.sh)
# 2. Supabase must be running (see Prerequisites)
# 3. Update test dependencies:
npx nx update:test-deps:bun supabase-js

# Run Bun tests
npx nx test:bun supabase-js
```

#### WebSocket Browser Testing

```bash
# Prerequisites:
# 1. Supabase must be running (see Prerequisites)
# 2. Build the UMD bundle first:
npx nx build supabase-js

# Run WebSocket browser tests with Playwright
cd packages/core/supabase-js/test/integration/node-browser
npm install
cp ../../../dist/umd/supabase.js .
npm run test
cd ../../..
```

#### CI/CD Testing

When running on CI, the tests automatically use the latest dependencies from the root project. The CI pipeline:

1. Builds the main project with current dependencies
2. Creates a package archive (`.tgz`) with the latest versions
3. Uses this archive in Expo, Next.js, Deno, and Bun tests to ensure consistency

### Updating Test Dependencies

The platform-specific tests (Expo, Next.js, Deno, Bun) use a packaged version of supabase-js rather than directly importing from source. This ensures they test the actual built package as it would be consumed by users.

#### How It Works

1. **Build** the current supabase-js package
2. **Pack** it into a `.tgz` file (like `npm pack` does)
3. **Copy** the `.tgz` to the test directory
4. **Install** it in the test project

This mimics how real users would install and use the package.

#### Update Scripts

```bash
# Update ALL test environment dependencies at once
# This builds, packs, and installs in all test directories
npx nx update:test-deps supabase-js

# Or update specific test environments:
npx nx update:test-deps:expo supabase-js    # Expo/React Native only
npx nx update:test-deps:next supabase-js    # Next.js only
npx nx update:test-deps:deno supabase-js    # Deno only
npx nx update:test-deps:bun supabase-js     # Bun only
```

**When to Update:**

- After making changes to the source code
- Before running platform-specific tests locally
- When debugging test failures that might be due to stale dependencies

**Note:** CI automatically handles this, so manual updates are only needed for local development.

### Test Coverage

#### Viewing Coverage Reports

```bash
# Generate coverage report
npx nx test:coverage supabase-js

# Serve coverage report locally (opens interactive HTML report)
npx nx serve:coverage supabase-js
# This starts a local server at http://localhost:3000 with the coverage report
```

The coverage report shows:

- Line coverage
- Branch coverage
- Function coverage
- Uncovered lines with highlights

Coverage results are also automatically uploaded to Coveralls in CI for tracking over time.

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.

## Badges

[![Coverage Status](https://coveralls.io/repos/github/supabase/supabase-js/badge.svg?branch=master)](https://coveralls.io/github/supabase/supabase-js?branch=master)
