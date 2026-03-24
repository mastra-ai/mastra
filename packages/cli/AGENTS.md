# AGENTS.md

## Scope

This file applies to work in `packages/cli/`.

## Overview

- `cli` is the main `mastra` command-line interface.
- It owns project creation, dev/build/start flows, migrations, and studio startup wiring.

## Commands

### Build

- `pnpm build:cli` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm test:cli` from the repository root.
- Use `pnpm test:watch` inside the package while iterating.

### Typecheck

- `pnpm typecheck` inside the package.
- `pnpm --filter ./packages/cli typecheck` from the repository root.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/cli lint` from the repository root.

## Working guidelines

- Preserve stable CLI behavior and minimize accidental UX churn.
- Check the relevant command module under `src/commands/` before refactoring shared CLI code.

## Verification

- Run `pnpm typecheck`, `pnpm test`, and `pnpm build:cli` after non-trivial changes, and avoid broader monorepo verification unless the CLI change clearly spans other packages.
- Do a manual CLI check when changing command wiring or scaffolding behavior.

## Dependencies

- Depends on `@mastra/deployer` and `@mastra/loggers`.
- `create-mastra` reuses CLI create behavior.
