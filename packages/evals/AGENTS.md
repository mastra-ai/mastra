# AGENTS.md

## Scope

This file applies to work in `packages/evals/`.

## Overview

- `evals` provides deterministic and LLM-based scoring utilities.
- Keep scorer logic focused and avoid adding persistence concerns here.

## Commands

### Build

- `pnpm build:evals` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm test:evals` from the repository root.

### Typecheck

- `pnpm check` inside the package.
- `pnpm --filter ./packages/evals check` from the repository root.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/evals lint` from the repository root.

## Working guidelines

- Keep deterministic scorers and LLM-based scorers conceptually separate.
- Be deliberate when changing prompt-based scorer behavior or recordings.

## Verification

- Run `pnpm check`, `pnpm test`, and `pnpm build:lib` after non-trivial changes.
- Prefer focused scorer tests for the area you changed.

## Dependencies

- Uses `@mastra/core` as a peer dependency.
