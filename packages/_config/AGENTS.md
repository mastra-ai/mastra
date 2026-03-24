# AGENTS.md

## Scope

This file applies to work in `packages/_config/`.

## Overview

- `_config` contains shared lint and formatting configuration published to the workspace as `@internal/lint`.
- It is config-only infrastructure, so changes here can affect many packages at once.

## Commands

### Build

- This package has no root build script.
- Validate changes through focused consumer lint runs from the repository root, such as `pnpm --filter ./packages/core lint`.

### Test

- This package has no test script.
- Validate changes through the narrowest affected consumer lint run.

### Typecheck

- This package has no typecheck script.
- Use consumer lint runs as the practical validation step.

### Lint and format

- This package has no local lint script.
- From the repository root, run a focused consumer lint command such as `pnpm --filter ./packages/core lint` or another directly affected package.

## Working guidelines

- Keep changes tightly scoped to shared ESLint or Prettier configuration.
- Avoid package-specific rule tuning here unless it truly belongs in the shared baseline.

## Verification

- Run lint in at least one directly affected consumer package.
- If you change shared rules, validate more than one representative package before finishing.

## Dependencies

- Many packages consume `@internal/lint`, so small config changes can have broad workspace impact.
