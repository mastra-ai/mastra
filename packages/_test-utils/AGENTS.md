# AGENTS.md

## Scope

This file applies to work in `packages/_test-utils/`.

## Overview

- `_test-utils` provides shared helpers for Mastra package tests.
- Changes here can ripple into many downstream test suites.

## Commands

### Build

- `pnpm --filter ./packages/_test-utils build` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm --filter ./packages/_test-utils test` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use the build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/_test-utils lint` from the repository root.

## Working guidelines

- Keep helpers stable across supported AI SDK versions.
- Prefer narrowly scoped helper changes over package-specific hacks.

## Verification

- Run `pnpm test` after source changes.
- Verify at least one affected consumer when changing mocks or setup behavior.

## Dependencies

- Depends on `_llm-recorder` and is consumed broadly across package tests.
