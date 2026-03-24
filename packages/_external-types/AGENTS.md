# AGENTS.md

## Scope

This file applies to work in `packages/_external-types/`.

## Overview

- `_external-types` publishes shared external provider and compatibility types used across the workspace.
- It is a small package, but type changes here can ripple into many downstream builds.

## Commands

### Build

- `pnpm --filter ./packages/_external-types build:lib` from the repository root.
- `pnpm --filter ./packages/_external-types build` from the repository root for the API Extractor step.

### Test

- `pnpm test` inside the package.
- `pnpm --filter ./packages/_external-types test` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use `pnpm build:lib` plus `pnpm build` as the main type and API-surface validation.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/_external-types lint` from the repository root.

## Working guidelines

- Keep changes tightly scoped to shared external typing and compatibility surfaces.
- Review API Extractor output carefully when exported types change.

## Verification

- Run `pnpm test`, `pnpm build:lib`, and `pnpm build` after source changes.
- Validate at least one directly affected consumer when exported types or provider contracts change.

## Dependencies

- Depends on `@internal/types-builder` and is consumed by packages that share provider-facing type surfaces.
