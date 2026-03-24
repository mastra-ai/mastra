# AGENTS.md

## Scope

This file applies to work in `packages/_internal-core/`.

## Overview

- `_internal-core` is a small internal package for shared core-adjacent exports, currently centered on storage subpath output.
- Keep changes narrow because downstream packages can consume these exports indirectly.

## Commands

### Build

- `pnpm --filter ./packages/_internal-core build:lib` from the repository root.

### Test

- This package has no test script.
- Validate behavior through targeted consumer builds or tests when changing exported contracts.

### Typecheck

- `pnpm typecheck` inside the package.
- `pnpm --filter ./packages/_internal-core typecheck` from the repository root.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/_internal-core lint` from the repository root.

## Working guidelines

- Treat this as shared internal infrastructure, not a place for product-specific logic.
- Preserve the current subpath export shape unless an explicit contract change is required.

## Verification

- Run `pnpm typecheck`, `pnpm lint`, and `pnpm build:lib` after changes.
- Verify at least one consumer package if you alter exported types or storage-facing contracts.

## Dependencies

- Internal packages may rely on these exports through shared core build paths.
