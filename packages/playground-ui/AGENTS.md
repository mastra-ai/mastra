# AGENTS.md

## Scope

This file applies to work in `packages/playground-ui/`.

## Overview

- `playground-ui` is the React component library and design-system package for studio experiences.
- Changes here often affect both library consumers and the private `playground` app.

## Commands

### Build

- `pnpm build:playground-ui` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm --filter ./packages/playground-ui test` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- `pnpm build` is the main type-aware validation step inside the package.

### Lint and format

- No package-local lint script is defined.
- Use the root lint flow if lint verification is needed for touched files.

## Working guidelines

- Preserve design-system consistency and existing component APIs where possible.
- Use Storybook or a realistic consumer when visual behavior is hard to validate from tests alone.

## Verification

- Run `pnpm test` for component logic changes.
- Run `pnpm build` after source or styling changes.
- Run the required `e2e-frontend-validation` step for frontend changes before merging.
- Use Storybook or a targeted app check for visual behavior instead of broader monorepo builds.

## Dependencies

- The private `playground` app is the main downstream consumer.
