# AGENTS.md

## Scope

This file applies to work in `packages/auth/`.

## Overview

- `auth` contains the core Mastra auth helpers, currently centered on JWT behavior.
- Keep the package small and focused.

## Commands

### Build

- `pnpm build:auth` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm --filter ./packages/auth test` from the repository root.
- Use `pnpm test:auth` from the repository root when you need the broader auth/server-adapter path.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/auth lint` from the repository root.

## Working guidelines

- Be careful when changing JWT parsing, signing, or JWKS behavior.
- Avoid adding unrelated framework-level auth concerns here.

## Verification

- Run `pnpm test`, `pnpm build:lib`, and `pnpm lint` after source changes.

## Dependencies

- Consumer auth flows downstream rely on this package staying stable.
