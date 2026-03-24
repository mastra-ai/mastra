# AGENTS.md

## Scope

This file applies to work in `packages/agent-builder/`.

## Overview

- `agent-builder` is an experimental package for building Mastra apps, agents, and workflows from requirements.
- Treat the API surface as unstable and keep changes surgical.

## Commands

### Build

- `pnpm --filter ./packages/agent-builder build` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm test:agent-builder` from the repository root.
- Use `pnpm test:agent-builder:integration` from the repository root when changing integration behavior.

### Typecheck

- `pnpm check` inside the package.
- `pnpm --filter ./packages/agent-builder check` from the repository root.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/agent-builder lint` from the repository root.

## Working guidelines

- Avoid turning experimental code into broad abstractions.
- Inspect `integration-tests/` before changing workflow or processor behavior.

## Verification

- Run `pnpm check`, `pnpm test`, and `pnpm build` after meaningful changes.
- Add integration coverage when modifying end-to-end builder behavior.

## Dependencies

- Uses `@mastra/core` as a peer and depends on `@mastra/memory` and `@mastra/schema-compat`.
