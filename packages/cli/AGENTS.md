# AGENTS.md

## Scope

This file applies to work in `packages/cli/`.

## Commands

- Build from root: `pnpm build:cli`
- Test from root: `pnpm test:cli`
- Typecheck from root: `pnpm --filter ./packages/cli typecheck`

## Test shape

- Most validation is package-scoped tests plus CLI typecheck/build checks

## Notes

- Preserve stable CLI behavior
