# AGENTS.md

## Scope

This file applies to work in `packages/codemod/`.

## Overview

- `codemod` provides AST-based migrations for Mastra upgrades.
- The package is driven by fixtures and tests.

## Commands

### Build

- `pnpm --filter ./packages/codemod build` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm --filter ./packages/codemod test` from the repository root.
- Use `pnpm test:watch` inside the package while iterating.

### Typecheck

- `pnpm typecheck` inside the package.
- `pnpm --filter ./packages/codemod typecheck` from the repository root.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/codemod lint` from the repository root.

## Working guidelines

- Keep changes tied to fixtures and failing tests.
- Prefer existing AST helpers over bespoke transformations when a shared pattern already exists.

## Verification

- Run the narrowest codemod tests for the transforms you changed.
- Include representative fixtures for new codemods.

## Dependencies

- This package affects migration tooling rather than runtime behavior.
