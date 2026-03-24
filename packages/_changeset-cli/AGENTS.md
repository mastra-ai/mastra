# AGENTS.md

## Scope

This file applies to work in `packages/_changeset-cli/`.

## Overview

- `_changeset-cli` is the internal helper for creating and managing changesets.
- Use it when you are changing release tooling or changeset authoring behavior.

## Commands

### Build

- This package has no dedicated root build script.
- If you need to validate CLI behavior here, run `pnpm start` inside `packages/_changeset-cli`.

### Test

- No package-local test script is defined.
- Add or run focused Vitest coverage only when you touch the existing test surface.

### Typecheck

- `pnpm typecheck` inside the package.
- `pnpm --filter ./packages/_changeset-cli typecheck` from the repository root.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/_changeset-cli lint` from the repository root.

## Working guidelines

- Keep prompt flow and changed-package detection predictable.
- Avoid broad UX rewrites in an internal developer tool.

## Verification

- Run `pnpm typecheck` and `pnpm lint` after changes.
- Validate the interactive flow with `pnpm start` when command behavior changes.

## Dependencies

- Changes here affect release and changeset workflows for the whole repository.
