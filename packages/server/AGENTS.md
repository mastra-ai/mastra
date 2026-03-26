# AGENTS.md

## Scope

This file applies to work in `packages/server/`.

## Commands

- Build from root: `pnpm build:server`
- Test from root: `pnpm test:server`
- If you change permissions, also run `pnpm --filter ./packages/server generate:permissions` and `pnpm --filter ./packages/server check:permissions`

## Test shape

- Most validation is package-scoped tests plus build output
- Permission and handler-contract changes need extra verification

## Notes

- Respect the package's subpath exports
