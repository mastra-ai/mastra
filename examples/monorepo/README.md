# Monorepo Example: Investigating libSQL Import Issues

Welcome to this minimal reproducible example designed to highlight and troubleshoot libSQL client import issues within monorepos.

## Overview

This repository contains two projects:
- **apps/web**: A standard Next.js application.
- **packages/ai**: A workspace package consumed by the web app.

The web application imports code from the `@monorepo/ai` workspace package. The main focus is to surface and resolve issues related to importing the libSQL client in this monorepo setup.

## Getting Started

To reproduce the issue and run the example:

1. From the `examples/monorepo` directory, install dependencies:
   ```bash
   pnpm install
   ```

2. Copy the environment example file and provide your OpenAI API key:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and fill in your OpenAI key
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

## Errors Encountered

When running `pnpm dev` the console is full of:

```
 ⚠ ./node_modules/.pnpm/@libsql+client@0.14.0/node_modules/@libsql/client/lib-esm
Package libsql can't be external
The request libsql matches serverExternalPackages (or the default list).
The request could not be resolved by Node.js from the project directory.
Packages that should be external need to be installed in the project directory, so they can be resolved from the output files.
Try to install it into the project directory by running npm install libsql from the project directory.
```

and also:

```
Error: could not resolve "@libsql/darwin-arm64" into a module
    at <unknown> (.next/server/chunks/ssr/69111_@mastra_core_dist_storage_libsql_index_e147a2b3.js:12:16)
 ⨯ unhandledRejection: Error: could not resolve "@libsql/darwin-arm64" into a module
    at <unknown> (.next/server/chunks/ssr/69111_@mastra_core_dist_storage_libsql_index_e147a2b3.js:12:16)
 ⨯ unhandledRejection:  Error: could not resolve "@libsql/darwin-arm64" into a module
    at <unknown> (.next/server/chunks/ssr/69111_@mastra_core_dist_storage_libsql_index_e147a2b3.js:12:16)
Error: could not resolve "@libsql/darwin-arm64" into a module
    at <unknown> (.next/server/chunks/ssr/69111_@mastra_core_dist_storage_libsql_index_e147a2b3.js:12:16)
 ⨯ unhandledRejection: Error: could not resolve "@libsql/darwin-arm64" into a module
    at <unknown> (.next/server/chunks/ssr/69111_@mastra_core_dist_storage_libsql_index_e147a2b3.js:12:16)
 ⨯ unhandledRejection:  Error: could not resolve "@libsql/darwin-arm64" into a module
    at <unknown> (.next/server/chunks/ssr/69111_@mastra_core_dist_storage_libsql_index_e147a2b3.js:12:16)
```

running `pnpm build` in apps/web:

```
../../node_modules/.pnpm/@libsql+hrana-client@0.7.0/node_modules/@libsql/hrana-client/README.md
Module parse failed: Unexpected character ' ' (1:1)
You may need an appropriate loader to handle this file type, currently no loaders are configured to process this file. See https://webpack.js.org/concepts#loaders
> # Hrana client for TypeScript
|
| **[API docs][docs] | [Github][github] | [npm][npm]**

Import trace for requested module:
../../node_modules/.pnpm/@libsql+hrana-client@0.7.0/node_modules/@libsql/hrana-client/README.md
../../node_modules/.pnpm/libsql@0.4.7/node_modules/@libsql/ ../../node_modules/.pnpm/node_modules/@libsql/ ../../node_modules/.pnpm/node_modules/@libsql/ ../../node_modules/.pnpm/libsql@0.4.7/node_modules/@libsql/ ../../node_modules/.pnpm/node_modules/@libsql/ ../../node_modules/.pnpm/node_modules/@libsql/ sync ^\.\/.*$
../../node_modules/.pnpm/libsql@0.4.7/node_modules/libsql/index.js
../../node_modules/.pnpm/@libsql+client@0.14.0/node_modules/@libsql/client/lib-esm/sqlite3.js
../../node_modules/.pnpm/@libsql+client@0.14.0/node_modules/@libsql/client/lib-esm/node.js
../../node_modules/.pnpm/@mastra+core@0.9.0_openapi-types@12.1.3_react@19.1.0_zod@3.24.3/node_modules/@mastra/core/dist/storage/libsql/index.js
../../node_modules/.pnpm/@mastra+core@0.9.0_openapi-types@12.1.3_react@19.1.0_zod@3.24.3/node_modules/@mastra/core/dist/chunk-LANFNMEE.js
../../node_modules/.pnpm/@mastra+core@0.9.0_openapi-types@12.1.3_react@19.1.0_zod@3.24.3/node_modules/@mastra/core/dist/chunk-RASVJ3TR.js
../../node_modules/.pnpm/@mastra+core@0.9.0_openapi-types@12.1.3_react@19.1.0_zod@3.24.3/node_modules/@mastra/core/dist/mastra/index.js
../../packages/ai/src/index.ts
./src/app/action-ask.ts
```
