# AGENTS.md

## Scope

This file applies to work in `packages/fastembed/`.

## Overview

- `fastembed` provides FastEmbed-based embedding integrations.
- It is separated from core because of heavy native/runtime dependencies.

## Commands

### Build

- `pnpm --filter ./packages/fastembed build` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm --filter ./packages/fastembed test` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- No package-local lint script is defined.

## Working guidelines

- Be careful with warmup, cache paths, and native dependency assumptions.
- Avoid unnecessary package-weight or initialization-cost changes.

## Verification

- Run `pnpm test` after logic changes.
- Run `pnpm build` after changing exports or package wiring.

## Dependencies

- Downstream embedding, memory, and retrieval flows depend on this package.
