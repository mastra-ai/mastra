# AGENTS.md

## Scope

This file applies to work in `packages/create-mastra/`.

## Overview

- `create-mastra` is the thin project-scaffolding CLI.
- Keep it small and reuse the main CLI flow instead of duplicating logic.

## Commands

### Build

- `pnpm --filter ./packages/create-mastra build` from the repository root.

### Test

- No package-local test script is defined.
- Validate scaffolding changes with a manual project-creation check when needed.

### Typecheck

- No package-local typecheck script is defined.
- Use the build as the main validation step.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/create-mastra lint` from the repository root.

## Working guidelines

- Preserve the thin wrapper role around the main CLI create flow.
- This package uses Rollup; do not rewrite it to tsup without an explicit reason.

## Verification

- Run `pnpm build` and `pnpm lint` after changes.
- Do a manual scaffolding check when behavior changes.

## Dependencies

- Depends on the main `mastra` CLI package.
