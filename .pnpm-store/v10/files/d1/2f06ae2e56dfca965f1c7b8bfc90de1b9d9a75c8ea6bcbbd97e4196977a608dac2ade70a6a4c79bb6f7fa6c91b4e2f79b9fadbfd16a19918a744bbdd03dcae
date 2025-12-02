<br />
<p align="center">
  <a href="https://supabase.io">
        <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-wordmark--light.svg">
      <img alt="Supabase Logo" width="300" src="https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/logo-preview.jpg">
    </picture>
  </a>

  <h1 align="center">Supabase Functions JS SDK</h1>

  <h3 align="center">JavaScript SDK to interact with Supabase Edge Functions.</h3>

  <p align="center">
    <a href="https://supabase.com/docs/guides/functions">Guides</a>
    ·
    <a href="https://supabase.com/docs/reference/javascript/functions-invoke">Reference Docs</a>
    ·
    <a href="https://supabase.github.io/supabase-js/functions-js/v2/spec.json">TypeDoc</a>
  </p>
</p>

<div align="center">

[![Build](https://github.com/supabase/supabase-js/workflows/CI/badge.svg)](https://github.com/supabase/supabase-js/actions?query=branch%3Amaster)
[![Package](https://img.shields.io/npm/v/@supabase/functions-js)](https://www.npmjs.com/package/@supabase/functions-js)
[![License: MIT](https://img.shields.io/npm/l/@supabase/supabase-js)](#license)
[![pkg.pr.new](https://pkg.pr.new/badge/supabase/functions-js)](https://pkg.pr.new/~/supabase/functions-js)

</div>

## Quick Start

### Installation

```bash
npm install @supabase/functions-js
```

### Usage

```js
import { FunctionsClient } from '@supabase/functions-js'

const functionsUrl = 'https://<project_ref>.supabase.co/functions/v1'
const anonKey = '<anon_key>'

const functions = new FunctionsClient(functionsUrl, {
  headers: {
    Authorization: `Bearer ${anonKey}`,
  },
})

// Invoke a function
const { data, error } = await functions.invoke('hello-world', {
  body: { name: 'Functions' },
})
```

## Development

This package is part of the [Supabase JavaScript monorepo](https://github.com/supabase/supabase-js). To work on this package:

### Building

```bash
# Complete build (from monorepo root)
npx nx build functions-js

# Build with watch mode for development
npx nx build functions-js --watch

# Individual build targets
npx nx build:main functions-js    # CommonJS build (dist/main/)
npx nx build:module functions-js  # ES Modules build (dist/module/)

# Other useful commands
npx nx clean functions-js         # Clean build artifacts
npx nx format functions-js        # Format code with Prettier
npx nx typecheck functions-js     # TypeScript type checking
npx nx docs functions-js          # Generate documentation
```

#### Build Outputs

- **CommonJS (`dist/main/`)** - For Node.js environments
- **ES Modules (`dist/module/`)** - For modern bundlers (Webpack, Vite, Rollup)
- **TypeScript definitions (`dist/module/index.d.ts`)** - Type definitions for TypeScript projects

### Testing

**Docker Required** for relay tests. The functions-js tests use testcontainers to spin up a Deno relay server for testing Edge Function invocations.

```bash
# Run all tests (from monorepo root)
npx nx test functions-js

# Run tests with coverage report
npx nx test functions-js --coverage

# Run tests in watch mode during development
npx nx test functions-js --watch

# CI test command (runs with coverage)
npx nx test:ci functions-js
```

#### Test Requirements

- **Node.js 20+** - Required for testcontainers
- **Docker** - Must be installed and running for relay tests
- No Supabase instance needed - Tests use mocked services and testcontainers

#### What Gets Tested

- **Function invocation** - Testing the `invoke()` method with various options
- **Relay functionality** - Using a containerized Deno relay to test real Edge Function scenarios
- **Error handling** - Ensuring proper error responses and retries
- **Request/response models** - Validating headers, body, and response formats

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details on how to get started.

For major changes or if you're unsure about something, please open an issue first to discuss your proposed changes.
