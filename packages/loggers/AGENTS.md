# AGENTS.md

## Scope

This file applies to work in `packages/loggers/`.

## Overview

- `loggers` provides transport implementations and logging integrations for Mastra.
- Most changes are transport-specific.

## Commands

### Build

- `pnpm --filter ./packages/loggers build:lib` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm --filter ./packages/loggers test` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/loggers lint` from the repository root.

## Working guidelines

- Preserve transport-specific behavior instead of over-generalizing the implementations.
- Be careful with batching, flushing, file I/O, and query semantics.

## Verification

- Run targeted tests for the exact transport or wrapper you changed.
- Run `pnpm build:lib` after export or packaging changes.

## Dependencies

- Many runtime packages rely on compatibility with `@mastra/core` logger transport expectations.
