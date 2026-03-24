# AGENTS.md

## Scope

This file applies to work in `packages/server/`.

## Overview

- `server` provides typed HTTP handlers and related utilities for exposing Mastra over HTTP.
- It affects API contracts, auth helpers, and server-adapter behavior.

## Commands

### Build

- `pnpm build:server` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm test:server` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/server lint` from the repository root.

## Working guidelines

- Respect the package's subpath-export structure instead of treating it like a single top-level API.
- Be careful with handler schemas, permissions generation, auth integration, and server-adapter contracts.

## Verification

- Run `pnpm test` after handler or schema changes, and keep verification package-scoped unless the change affects shared contracts outside `server`.
- Run the permission generation/check commands when permission inputs change.

## Dependencies

- CLI/dev-server flows and custom server integrations rely on this package.
