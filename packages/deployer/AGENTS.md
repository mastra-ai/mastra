# AGENTS.md

## Scope

This file applies to work in `packages/deployer/`.

## Overview

- `deployer` owns build, bundling, deployment, and related server infrastructure for Mastra apps.
- It is packaging- and environment-sensitive code.

## Commands

### Build

- `pnpm build:deployer` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm test:deployer` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/deployer lint` from the repository root.

## Working guidelines

- Inspect the exact area you are changing in `src/build/`, `src/bundler/`, `src/server/`, `src/services/`, or `src/validator/`.
- Be careful with filesystem, bundling, and deployment assumptions.

## Verification

- Run `pnpm test` and `pnpm build:lib` after source changes.
- Run the related generation/build flow if you change generated OpenAPI or packaging behavior.

## Dependencies

- CLI and deployment workflows downstream rely on this package.
