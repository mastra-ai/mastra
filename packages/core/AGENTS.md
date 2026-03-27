# AGENTS.md

## Scope

This file applies to work in `packages/core/`.

## Commands

- Build from root: `pnpm build:core`
- Test from root: `pnpm test:core`
- Typecheck from root: `pnpm --filter ./packages/core check`
- If you change Zod compatibility behavior, also run `pnpm test:core:zod` and `pnpm --filter ./packages/core typecheck:zod-compat`

## Test shape

- Most tests live under `packages/core/src/**`
- Run focused processor, harness, agent, or loop tests before broader validation when those areas change

## Notes

- Keep changes here surgical; many packages depend on `core`
