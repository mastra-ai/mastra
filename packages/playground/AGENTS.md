# AGENTS.md

## Scope

This file applies to work in `packages/playground/`.

## Overview

- `playground` is the private Mastra Studio web application.
- Treat changes here as product behavior changes, not just library edits.

## Commands

### Build

- `pnpm --filter ./packages/playground build` from the repository root.

### Test

- `pnpm test:e2e` inside the package.
- `pnpm --filter ./packages/playground test:e2e` from the repository root.
- Run `pnpm test:e2e:setup` before E2E work when the test environment needs setup.

### Typecheck

- No package-local typecheck script is defined.
- Use build and E2E flows to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/playground lint` from the repository root.

## Working guidelines

- Read the relevant route or domain code before changing shared app behavior.
- Coordinate with `playground-ui` when a change crosses app and component-library boundaries.

## Verification

- Run the narrowest relevant E2E coverage for behavior changes instead of falling back to workspace-wide verification.
- Use the running app for manual verification when UI behavior is involved.

## Dependencies

- This package is the main internal consumer of `@mastra/playground-ui`.
