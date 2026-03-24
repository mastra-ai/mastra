# AGENTS.md

## Scope

This file applies to work in `packages/schema-compat/`.

## Overview

- `schema-compat` is the shared compatibility layer for schema conversion and provider quirks.
- Small changes here can affect tool-schema behavior across multiple packages.

## Commands

### Build

- `pnpm build:schema-compat` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm test:schema-compat` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/schema-compat lint` from the repository root.

## Working guidelines

- Keep provider-specific compatibility logic explicit and localized.
- Review snapshot changes carefully instead of accepting them mechanically.

## Verification

- Run `pnpm test` after compatibility changes.
- Run `pnpm build` after export or packaging changes.

## Dependencies

- Shared runtime packages such as `core`, `memory`, and UI packages depend on this layer.
