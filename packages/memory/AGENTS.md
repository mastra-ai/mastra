# AGENTS.md

## Scope

This file applies to work in `packages/memory/`.

## Overview

- `memory` provides observational memory, working memory, recall tools, and related thread behavior.
- It is tightly coupled to `@mastra/core` contracts and uses both unit and integration coverage.

## Commands

### Build

- `pnpm build:memory` from the repository root.

### Test

- `pnpm test:unit`, `pnpm test:integration`, or `pnpm test` inside the package.
- `pnpm test:memory` from the repository root.
- Prefer unit tests first and run integration tests for storage-backed or end-to-end memory changes.

### Typecheck

- `pnpm check` inside the package.
- `pnpm --filter ./packages/memory check` from the repository root.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/memory lint` from the repository root.

## Working guidelines

- Keep processors, tools, and storage interactions clearly separated.
- Be careful with recorded fixtures and backend-specific integration behavior.

## Verification

- Run the narrowest relevant test suite first and avoid broader workspace commands unless memory changes spill into shared contracts.
- Run `pnpm test:integration` when changing storage-backed memory behavior.

## Dependencies

- Uses `@mastra/core` as a peer and depends on `@mastra/schema-compat`.
