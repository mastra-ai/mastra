# AGENTS.md

## Scope

This file applies to work in `packages/memory/`.

## Commands

- Build from root: `pnpm build:memory`
- Test from root: `pnpm test:memory`
- Typecheck from root: `pnpm --filter ./packages/memory check`
- For storage-backed changes, also run `pnpm --filter ./packages/memory test:integration`

## Test shape

- This package has both unit and integration coverage
- Integration tests matter for storage-backed memory behavior

## Notes

- Keep memory logic and storage behavior clearly separated
