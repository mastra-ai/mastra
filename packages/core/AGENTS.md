# AGENTS.md

## Scope

This file applies to work in `packages/core/`.

## Overview

- `core` is the central Mastra runtime package.
- Changes here often affect many downstream packages and should stay as surgical as possible.

## Commands

### Build

- `pnpm build:core` from the repository root.

### Test

- `pnpm test` or `pnpm test:unit` inside the package.
- `pnpm test:core` from the repository root.
- Use `pnpm test:types:zod` inside the package or `pnpm test:core:zod` from the repository root when changing Zod compatibility behavior.

### Typecheck

- `pnpm check` or `pnpm typecheck` inside the package.
- `pnpm --filter ./packages/core check` from the repository root.
- Run `pnpm --filter ./packages/core typecheck:zod-compat` when changing Zod compatibility surfaces.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/core lint` from the repository root.

## Working guidelines

- Read the local subsystem before editing, especially in `src/agent/`, `src/loop/`, `src/processors/`, `src/harness/`, `src/tools/`, and `src/storage/`.
- Start with the smallest relevant package-level command; do not jump to repo-wide builds or tests unless the change crosses package boundaries.
- Be especially careful with agent loop, streaming, processor, and message-list changes.

## Verification

- Run focused subsystem tests first, then broader package checks if needed.
- Verify at least one direct consumer when changing shared contracts or exported types.

## Dependencies

- Nearly every major package depends directly or indirectly on `core`.
